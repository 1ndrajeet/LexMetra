# backend/app/routers/inspection.py
"""
LexMetra inspection router — single file pipeline.
PaddleOCR -> Gemini 2.5 Flash -> structured facts -> DB.
"""
import os
# MUST be set before importing paddle
os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["FLAGS_enable_mkldnn"] = "0"

import json
import uuid
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List
from app.services.rules import evaluate as evaluate_rules

from fastapi import APIRouter, HTTPException, Depends, Path, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from dotenv import load_dotenv

from app.lib.db import get_db
from app.lib.models import (
    Inspection, Image, Declaration,
    ExtractedProduct, ExtractedField,
)
from app.lib.logger import VERBOSE, Timer
logger = logging.getLogger("lexmetra.inspection")

load_dotenv()
router = APIRouter()

# ============================================================
# CONFIG
# ============================================================
GEMINI_MODELS = ["gemini-3.8-flash","gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"]
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# ============================================================
# GEMINI CLIENT (lazy)
# ============================================================
_gemini_client = None

def _get_gemini():
    global _gemini_client
    if _gemini_client is None:
        if not GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY not set")
        from google import genai
        _gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    return _gemini_client


# ============================================================
# OCR (PaddleOCR 3.x)
# ============================================================
@dataclass
class OCRField:
    value: str
    confidence: float
    bbox: Optional[List[int]] = None   # [x, y, w, h]


@dataclass
class OCRResult:
    raw_text: str = ""
    fields: List[OCRField] = field(default_factory=list)
    confidence: float = 0.0
    success: bool = False
    error: Optional[str] = None


class PaddleOCRExtractor:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._ocr = None
        return cls._instance

    @property
    def ocr(self):
        if self._ocr is None:
            from paddleocr import PaddleOCR
            self._ocr = PaddleOCR(
                lang="en",
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
                enable_mkldnn=False,
            )
        return self._ocr

    def extract(self, image_path: str) -> OCRResult:
        result = OCRResult()
        try:
            pages = self.ocr.predict(image_path)
            if not pages:
                result.error = "No OCR results"
                return result

            all_text: List[str] = []
            fields: List[OCRField] = []

            for page in pages:
                texts = page.get("rec_texts")
                scores = page.get("rec_scores")
                boxes = page.get("rec_boxes")
                if boxes is None:
                    boxes = page.get("rec_polys")

                texts = list(texts) if texts is not None else []
                scores = list(scores) if scores is not None else []
                boxes = list(boxes) if boxes is not None else []

                for i, text in enumerate(texts):
                    text = str(text).strip()
                    if not text:
                        continue
                    conf = float(scores[i]) if i < len(scores) else 0.0

                    bbox = None
                    if i < len(boxes):
                        try:
                            box = boxes[i]
                            # rec_boxes: [x1, y1, x2, y2]
                            if hasattr(box, "tolist"):
                                box = box.tolist()
                            if len(box) >= 4:
                                x1, y1, x2, y2 = (
                                    int(box[0]), int(box[1]),
                                    int(box[2]), int(box[3]),
                                )
                                bbox = [x1, y1, max(1, x2 - x1), max(1, y2 - y1)]
                        except Exception:
                            bbox = None

                    all_text.append(text)
                    fields.append(OCRField(value=text, confidence=conf, bbox=bbox))

            result.raw_text = " ".join(all_text)
            result.fields = fields
            result.confidence = (
                sum(f.confidence for f in fields) / len(fields) if fields else 0.0
            )
            result.success = True

        except Exception as e:
            logger.exception("OCR failed for %s", image_path)
            result.error = str(e)
            result.success = False

        return result


def extract_from_image(path: str) -> OCRResult:
    return PaddleOCRExtractor().extract(path)


# ============================================================
# GEMINI EXTRACTION
# ============================================================
EXTRACTION_PROMPT = """You are a product label extraction and classification engine for Legal Metrology compliance under the Legal Metrology (Packaged Commodities) Rules, 2011 (India).

You are given OCR text extracted from ONE OR MORE photographs of the SAME packaged commodity. Combine information across them. Extract ONLY what is visibly present.

Return ONLY valid JSON:
{
  "product_name": "string|null",
  "brand": "string|null",
  "product_category": "string|null",
  "product_subcategory": "string|null",
  "manufacturer": "string|null",
  "manufacturer_address": "string|null",
  "packer": "string|null",
  "packer_address": "string|null",
  "importer": "string|null",
  "importer_address": "string|null",
  "country_of_origin": "string|null",
  "mrp": number|null,
  "mrp_currency": "INR",
  "net_quantity": "string|null",
  "net_quantity_unit": "g|kg|ml|l|...|null",
  "batch_number": "string|null",
  "manufacturing_date": "YYYY-MM-DD|null",
  "expiry_date": "YYYY-MM-DD|null",
  "best_before": "string|null",
  "fssai_license": "string|null",
  "ingredients": "string|null",
  "nutritional_info": "string|null",
  "storage_instructions": "string|null",
  "usage_instructions": "string|null",
  "customer_care": "string|null",
  "website": "string|null",
  "product_code": "string|null"
}

PRODUCT CATEGORY (India LMPC + FSSAI context):
Pick the SINGLE best match for "product_category":
  - "food"            (any edible item, beverage, snack, spice, oil, grain, dairy, sweet, etc.)
  - "drug"            (medicine, pharmaceutical, formulation)
  - "cosmetic"        (personal-care, soap, shampoo, cream, toothpaste)
  - "medical_device"  (thermometer, glucose meter, etc.)
  - "household"       (detergent, cleaner, non-edible consumable)
  - "agricultural"    (seeds, fertilizer, pesticide)
  - "industrial"      (raw material, tools, machinery)
  - "other"           (if unclear)

PRODUCT SUBCATEGORY: a short noun phrase describing the commodity
  - examples: "instant coffee", "biscuits", "edible oil", "shampoo", "tablet"
  - Do NOT use brand names here.

RULES:
- NEVER invent values. Use null if not present.
- MRP is the retail price, not unit price.
- Dates must be ISO (YYYY-MM-DD). Month/year only → YYYY-MM-01.
- Strip currency symbols from "mrp".
- Do NOT make any compliance decision.

OCR TEXT:
---
{text}
---

JSON:"""


def _extract_with_gemini(text: str) -> dict:
    if not text or len(text.strip()) < 10:
        return {"success": False, "error": "Text too short", "data": {}}

    prompt = EXTRACTION_PROMPT.replace("{text}", text[:100000])
    last_err = None

    for model in GEMINI_MODELS:
        for attempt in (1, 2, 3):
            try:
                client = _get_gemini()
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                )
                raw = (response.text or "").strip()

                if "```json" in raw:
                    raw = raw.split("```json", 1)[1].split("```", 1)[0].strip()
                elif raw.startswith("```"):
                    raw = raw.split("```", 1)[1].split("```", 1)[0].strip()

                data = json.loads(raw)
                return {"success": True, "data": data, "error": None, "model": model}

            except json.JSONDecodeError as e:
                logger.error("Invalid JSON from %s: %s", model, e)
                last_err = f"Invalid JSON: {e}"
                break  # no point retrying same model for bad JSON
            except Exception as e:
                last_err = str(e)
                # Retry on 503/429, then fall through to next model
                if "503" in last_err or "429" in last_err or "UNAVAILABLE" in last_err:
                    import time
                    wait = 2 ** attempt
                    logger.warning(
                        "Gemini %s busy (attempt %d/3) — waiting %ds",
                        model, attempt, wait,
                    )
                    time.sleep(wait)
                    continue
                logger.exception("Gemini failed with %s", model)
                break  # non-retryable

    return {"success": False, "error": last_err or "All models failed", "data": {}}


# ============================================================
# NORMALIZATION (snake_case -> DB camelCase)
# ============================================================
def _clean_date(v):
    if not v:
        return None
    s = str(v).strip()
    # Gemini already returns ISO — trust it
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
        return s
    if re.fullmatch(r"\d{4}-\d{2}", s):
        return f"{s}-01"
    # Fallback: parse DD/MM/YY or DD/MM/YYYY (India = day-first)
    for pat in (
        r"(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})",
        r"(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})",
    ):
        m = re.search(pat, s)
        if m:
            g = m.groups()
            if len(g[0]) == 4:
                return f"{g[0]}-{int(g[1]):02d}-{int(g[2]):02d}"
            d, mo, y = int(g[0]), int(g[1]), int(g[2])
            if y < 100:
                y += 2000 if y < 50 else 1900
            return f"{y:04d}-{mo:02d}-{d:02d}"
    return s


def _clean_price(v):
    if v is None:
        return None
    m = re.search(r"(\d+\.?\d*)", str(v))
    if not m:
        return None
    try:
        return float(m.group(1))
    except (TypeError, ValueError):
        return None

_FIELD_MAP = {
    "product_name": "productName",
    "brand": "brand",
    "product_category": "productCategory",
    "product_subcategory": "productSubcategory",
    "manufacturer": "manufacturer",
    "manufacturer_address": "manufacturerAddress",
    "packer": "packer",
    "packer_address": "packerAddress",
    "importer": "importer",
    "importer_address": "importerAddress",
    "mrp": "mrp",
    "mrp_currency": "mrpCurrency",
    "net_quantity": "netQuantity",
    "net_quantity_unit": "netQuantityUnit",
    "batch_number": "batchNumber",
    "manufacturing_date": "manufacturingDate",
    "expiry_date": "expiryDate",
    "best_before": "bestBefore",
    "fssai_license": "fssaiLicense",
    "ingredients": "ingredients",
    "nutritional_info": "nutritionalInfo",
    "usage_instructions": "usageInstructions",
    "storage_instructions": "storageInstructions",
    "country_of_origin": "countryOfOrigin",
    "product_code": "productCode",
    "website": "website",
    "customer_care": "customerCare",
}


def _standardize(data: dict) -> dict:
    out = {}
    for k, v in (data or {}).items():
        key = _FIELD_MAP.get(k, k)
        if k == "mrp":
            v = _clean_price(v)
        elif k in ("manufacturing_date", "expiry_date"):
            v = _clean_date(v)
        out[key] = v
    return out


# ============================================================
# ROUTES
# ============================================================
@router.post("/inspect/{inspection_id}")
async def inspect_images(
    inspection_id: str = Path(...),
    db: Session = Depends(get_db),
):
    logger.info(f"{'='*60}")
    logger.info(f"INSPECT START  id={inspection_id}")
    logger.info(f"{'='*60}")

    with Timer(logger, "Load inspection from DB"):
        inspection = db.query(Inspection).filter(Inspection.id == inspection_id).first()
        if not inspection:
            raise HTTPException(404, "Inspection not found")

        images = (
            db.query(Image)
            .filter(Image.inspectionId == inspection_id)
            .order_by(Image.orderNum)
            .all()
        )
        if not images:
            raise HTTPException(400, "No images for this inspection")

        existing = db.query(ExtractedProduct).filter(
            ExtractedProduct.inspectionId == inspection_id
        ).first()
        if existing:
            logger.info(f"Already extracted → returning cached  status={existing.extractionStatus}")
            return {
                "success": True,
                "inspection_id": inspection_id,
                "message": "Already extracted",
                "extracted_product_id": existing.id,
                "extraction_status": existing.extractionStatus,
            }

    logger.info(f"Found {len(images)} image(s) to process")

    processed, failed, text_parts = [], [], []
    total_ocr_fields = 0

    try:
        # ---------- 1. OCR ----------
        logger.info(f"{'-'*60}")
        logger.info(f"STEP 1 — OCR (PaddleOCR)")
        logger.info(f"{'-'*60}")

        for idx, image in enumerate(images, start=1):
            logger.info(f"  [{idx}/{len(images)}] {image.url}")

            if not os.path.exists(image.url):
                logger.warning(f"    File missing — skipping")
                failed.append({"image_id": image.id, "error": "File missing"})
                continue

            with Timer(logger, f"    PaddleOCR on image {idx}"):
                ocr = extract_from_image(image.url)

            if not ocr.success:
                logger.error(f"    OCR failed: {ocr.error}")
                failed.append({"image_id": image.id, "error": ocr.error})
                continue

            avg_conf = ocr.confidence
            logger.info(f"    Extracted {len(ocr.fields)} lines  (avg conf={avg_conf:.2f})")
            if VERBOSE:
                for f in ocr.fields[:5]:
                    logger.info(f"      • '{f.value[:60]}'  conf={f.confidence:.2f}  bbox={f.bbox}")
                if len(ocr.fields) > 5:
                    logger.info(f"      … +{len(ocr.fields) - 5} more")

            for idx2, f in enumerate(ocr.fields):
                db.add(Declaration(
                    id=str(uuid.uuid4()),
                    inspectionId=inspection_id,
                    field=f"text_line_{idx2 + 1}",
                    value=f.value,
                    confidence=f.confidence,
                    status="PASS",
                    sourceImageId=image.id,
                    bbox=f.bbox,
                    createdAt=datetime.utcnow(),
                ))

            total_ocr_fields += len(ocr.fields)
            text_parts.append(ocr.raw_text)
            processed.append({
                "image_id": image.id,
                "url": image.url,
                "text_count": len(ocr.fields),
            })

        if not text_parts:
            raise HTTPException(400, "No text extracted from any image")

        db.commit()
        logger.info(f"Committed {total_ocr_fields} OCR lines to DB")

        # ---------- 2. Gemini ----------
        logger.info(f"{'-'*60}")
        logger.info(f"STEP 2 — Gemini structured extraction")
        logger.info(f"{'-'*60}")

        full_text = " ".join(text_parts)
        logger.info(f"Combined OCR text: {len(full_text)} chars")

        extracted = ExtractedProduct(
            id=str(uuid.uuid4()),
            inspectionId=inspection_id,
            rawTextUsed=full_text[:10000],
            extractionStatus="processing",
            createdAt=datetime.utcnow(),
        )
        db.add(extracted)
        db.commit()
        db.refresh(extracted)

        with Timer(logger, "  Gemini call (with retries/fallbacks)"):
            gem = _extract_with_gemini(full_text)

        if not gem["success"]:
            logger.error(f"  Gemini failed: {gem.get('error')}")
            extracted.extractionStatus = "failed"
            db.commit()
            raise HTTPException(500, gem.get("error", "Gemini failed"))

        logger.info(f"  Gemini responded via model={gem.get('model')}")

        with Timer(logger, "  Normalize fields"):
            structured = _standardize(gem["data"])

        if VERBOSE:
            logger.info(f"  Extracted fields:")
            for k, v in structured.items():
                vs = str(v)[:70] if v is not None else "null"
                logger.info(f"    {k:24s} = {vs}")

        # ---------- 3. Persist ----------
        logger.info(f"{'-'*60}")
        logger.info(f"STEP 3 — Persist structured facts")
        logger.info(f"{'-'*60}")

        with Timer(logger, "  Write ExtractedProduct"):
            extracted.productName = structured.get("productName")
            extracted.brand = structured.get("brand")
            extracted.manufacturer = structured.get("manufacturer")
            extracted.manufacturerAddress = structured.get("manufacturerAddress")
            extracted.importer = structured.get("importer")
            extracted.mrp = structured.get("mrp")
            extracted.mrpCurrency = structured.get("mrpCurrency") or "INR"
            extracted.netQuantity = structured.get("netQuantity")
            extracted.netQuantityUnit = structured.get("netQuantityUnit")
            extracted.batchNumber = structured.get("batchNumber")
            extracted.manufacturingDate = structured.get("manufacturingDate")
            extracted.expiryDate = structured.get("expiryDate")
            extracted.fssaiLicense = structured.get("fssaiLicense")
            extracted.ingredients = structured.get("ingredients")
            extracted.nutritionalInfo = structured.get("nutritionalInfo")
            extracted.usageInstructions = structured.get("usageInstructions")
            extracted.storageInstructions = structured.get("storageInstructions")
            extracted.countryOfOrigin = structured.get("countryOfOrigin")
            extracted.productCode = structured.get("productCode")
            extracted.website = structured.get("website")
            extracted.customerCare = structured.get("customerCare")
            extracted.confidenceScore = 0.85
            extracted.extractionStatus = "completed"
            extracted.updatedAt = datetime.utcnow()

            for name, value in (gem["data"] or {}).items():
                if value in (None, "", "null"):
                    continue
                db.add(ExtractedField(
                    id=str(uuid.uuid4()),
                    extractedProductId=extracted.id,
                    fieldName=name,
                    fieldValue=str(value),
                    confidence=0.85,
                    createdAt=datetime.utcnow(),
                ))

            inspection.status = "partial" if failed else "completed"
            inspection.completedAt = datetime.utcnow()
            db.commit()

        logger.info(f"{'='*60}")
        logger.info(
            f"INSPECT DONE  id={inspection_id}  "
            f"status={inspection.status}  fields={len(gem['data'])}"
        )
        logger.info(f"{'='*60}")

        preview = full_text[:300] + ("..." if len(full_text) > 300 else "")
        # ---------- 4. Rule engine ----------
        logger.info(f"{'-'*60}")
        logger.info(f"STEP 4 — LMPC rule engine")
        logger.info(f"{'-'*60}")

        with Timer(logger, "  Evaluate rules"):
            rule_result = evaluate_rules(structured)

        if VERBOSE:
            logger.info(f"  Overall: {rule_result['overall_status']}  "
                        f"(P={rule_result['summary']['PASS']} "
                        f"F={rule_result['summary']['FAIL']} "
                        f"U={rule_result['summary']['UNCERTAIN']} "
                        f"NA={rule_result['summary']['NOT_APPLICABLE']})")
            for f in rule_result["findings"]:
                logger.info(f"    [{f['status']:14s}] {f['rule_id']:35s} {f['reason']}")

        inspection.verdict = rule_result["overall_status"]
        db.commit()
        return {
            "success": True,
            "inspection_id": inspection_id,
            "total_images": len(images),
            "processed": processed,
            "failed": failed,
            "total_ocr_fields": total_ocr_fields,
            "text_preview": preview,
            "extracted_product_id": extracted.id,
            "extraction_status": extracted.extractionStatus,
            "structured_data": structured,
            "rule_evaluation": rule_result,
            "status": inspection.status,
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.exception("Inspection failed")
        raise HTTPException(500, f"Inspection failed: {e}")
        

@router.get("/inspection/{inspection_id}")
async def get_inspection(
    inspection_id: str,
    include_declarations: bool = Query(False),
    include_extracted: bool = Query(True),
    db: Session = Depends(get_db),
):
    inspection = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not inspection:
        raise HTTPException(404, "Inspection not found")

    images = (
        db.query(Image)
        .filter(Image.inspectionId == inspection_id)
        .order_by(Image.orderNum)
        .all()
    )

    response = {
        "id": inspection.id,
        "product_name": inspection.productName,
        "verdict": inspection.verdict,
        "score": inspection.score,
        "status": inspection.status,
        "created_at": inspection.createdAt,
        "completed_at": inspection.completedAt,
        "image_count": len(images),
        "images": [
            {"id": i.id, "url": i.url, "order": i.orderNum, "created_at": i.createdAt}
            for i in images
        ],
    }

    if include_declarations:
        decls = db.query(Declaration).filter(Declaration.inspectionId == inspection_id).all()
        response["declarations"] = [
            {
                "id": d.id, "field": d.field, "value": d.value,
                "confidence": d.confidence, "status": d.status,
                "bbox": d.bbox, "created_at": d.createdAt,
            }
            for d in decls
        ]
        response["declaration_count"] = len(decls)

    if include_extracted:
        ex = db.query(ExtractedProduct).filter(
            ExtractedProduct.inspectionId == inspection_id
        ).first()
        if ex:
            response["extracted_data"] = {
                "id": ex.id,
                "extraction_status": ex.extractionStatus,
                "confidence": ex.confidenceScore,
                "created_at": ex.createdAt,
                "updated_at": ex.updatedAt,
                "data": {
                    "product_name": ex.productName,
                    "brand": ex.brand,
                    "manufacturer": ex.manufacturer,
                    "manufacturer_address": ex.manufacturerAddress,
                    "importer": ex.importer,
                    "mrp": ex.mrp,
                    "mrp_currency": ex.mrpCurrency,
                    "net_quantity": ex.netQuantity,
                    "net_quantity_unit": ex.netQuantityUnit,
                    "batch_number": ex.batchNumber,
                    "manufacturing_date": ex.manufacturingDate,
                    "expiry_date": ex.expiryDate,
                    "fssai_license": ex.fssaiLicense,
                    "ingredients": ex.ingredients,
                    "nutritional_info": ex.nutritionalInfo,
                    "usage_instructions": ex.usageInstructions,
                    "storage_instructions": ex.storageInstructions,
                    "country_of_origin": ex.countryOfOrigin,
                    "product_code": ex.productCode,
                    "website": ex.website,
                    "customer_care": ex.customerCare,
                },
            }

    return response


@router.get("/inspections")
async def get_inspections(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Inspection)
    if status:
        q = q.filter(Inspection.status == status)

    total = q.count()
    rows = q.order_by(Inspection.createdAt.desc()).offset(skip).limit(limit).all()
    ids = [r.id for r in rows]

    counts = {}
    if ids:
        rows_c = (
            db.query(Image.inspectionId, func.count(Image.id))
            .filter(Image.inspectionId.in_(ids))
            .group_by(Image.inspectionId)
            .all()
        )
        counts = {c[0]: c[1] for c in rows_c}

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "inspections": [
            {
                "id": r.id,
                "product_name": r.productName,
                "verdict": r.verdict,
                "status": r.status,
                "created_at": r.createdAt,
                "image_count": counts.get(r.id, 0),
            }
            for r in rows
        ],
    }


@router.delete("/inspection/{inspection_id}")
async def delete_inspection(inspection_id: str, db: Session = Depends(get_db)):
    inspection = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not inspection:
        raise HTTPException(404, "Inspection not found")
    try:
        images = db.query(Image).filter(Image.inspectionId == inspection_id).all()
        deleted = 0
        for img in images:
            if os.path.exists(img.url):
                os.remove(img.url)
                deleted += 1
        db.delete(inspection)
        db.commit()
        return {
            "success": True,
            "message": f"Inspection {inspection_id} deleted",
            "deleted_images": deleted,
            "total_images": len(images),
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Delete failed: {e}")