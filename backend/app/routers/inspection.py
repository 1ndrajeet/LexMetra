# backend/app/routers/inspection.py
"""
LexMetra inspection router — single file pipeline.
PaddleOCR -> Gemini 2.5 Flash -> structured facts -> rule engine.
camelCase end to end for the DB layer; the rule engine returns snake_case
keys, which is why the two reads near the bottom use snake_case.
"""
import os
os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["FLAGS_enable_mkldnn"] = "0"

import json
import uuid
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends, Path, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from dotenv import load_dotenv

from app.lib.db import get_db
from app.lib.models import (
    Inspection, Image, Declaration,
    ExtractedProduct, ExtractedField,
)
from app.services.rules import evaluate as evaluate_rules
from app.services.verification import verify_all
from app.lib.logger import VERBOSE, Timer

logger = logging.getLogger("lexmetra.inspection")

load_dotenv()
router = APIRouter()

GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"]
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


# ============================================================
# GEMINI CLIENT
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
class OcrField:
    value: str
    confidence: float
    bbox: Optional[List[int]] = None


@dataclass
class OcrResult:
    rawText: str = ""
    fields: List[OcrField] = field(default_factory=list)
    confidence: float = 0.0
    success: bool = False
    error: Optional[str] = None


class PaddleOcrExtractor:
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

    def extract(self, imagePath: str) -> OcrResult:
        result = OcrResult()
        try:
            pages = self.ocr.predict(imagePath)
            if not pages:
                result.error = "No OCR results"
                return result

            allText: List[str] = []
            fields: List[OcrField] = []

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

                    allText.append(text)
                    fields.append(OcrField(value=text, confidence=conf, bbox=bbox))

            result.rawText = " ".join(allText)
            result.fields = fields
            result.confidence = (
                sum(f.confidence for f in fields) / len(fields) if fields else 0.0
            )
            result.success = True

        except Exception as e:
            logger.exception("OCR failed for %s", imagePath)
            result.error = str(e)
            result.success = False

        return result


def extractFromImage(path: str) -> OcrResult:
    return PaddleOcrExtractor().extract(path)


# ============================================================
# GEMINI EXTRACTION PROMPT — camelCase output
# ============================================================
EXTRACTION_PROMPT = """You are a product label extraction and classification engine for Legal Metrology compliance under the Legal Metrology (Packaged Commodities) Rules, 2011 (India).

You are given OCR text extracted from ONE OR MORE photographs of the SAME packaged commodity. Combine information across them. Extract ONLY what is visibly present.

Return ONLY valid JSON with camelCase keys:
{
  "productName": "string|null",
  "brand": "string|null",
  "genericName": "string|null",
  "commonName": "string|null",
  "productCategory": "string|null",
  "productSubcategory": "string|null",
  "commodityType": "string|null",
  "commodityPhysicalState": "solid|semiSolid|viscous|liquid|solidAndLiquidMix|linear|area|count|null",
  "manufacturer": "string|null",
  "manufacturerAddress": "string|null",
  "packer": "string|null",
  "packerAddress": "string|null",
  "importer": "string|null",
  "importerAddress": "string|null",
  "countryOfOrigin": "string|null",
  "mrp": number|null,
  "mrpCurrency": "INR",
  "mrpRawText": "string|null",
  "netQuantityValue": number|null,
  "netQuantityUnit": "g|kg|ml|l|...|null",
  "netQuantityRawText": "string|null",
  "batchNumber": "string|null",
  "manufacturedDate": "YYYY-MM-DD|null",
  "packedDate": "YYYY-MM-DD|null",
  "importedDate": "YYYY-MM-DD|null",
  "expiryDate": "YYYY-MM-DD|null",
  "bestBeforeDate": "string|null",
  "fssaiLicense": "string|null",
  "ingredients": "string|null",
  "nutritionalInfo": "string|null",
  "storageInstructions": "string|null",
  "usageInstructions": "string|null",
  "customerCare": "string|null",
  "customerCarePhone": "string|null",
  "customerCareEmail": "string|null",
  "customerCareAddress": "string|null",
  "website": "string|null",
  "productCode": "string|null",
  "declarationLanguage": "hi|en|other|null",
  "declarationOnPdp": true|false|null,
  "finishedDimensions": "string|null",
  "usableSheetsCount": number|null,
  "sheetDimensions": "string|null"
}

PRODUCT CATEGORY:
  - "food" | "drug" | "cosmetic" | "medicalDevice" | "household" | "agricultural" | "industrial" | "other"

RULES:
- NEVER invent values. Use null if not present.
- MRP is the retail price, not unit price.
- Dates must be ISO (YYYY-MM-DD). Month/year only → YYYY-MM-01.
- Strip currency symbols from "mrp".
- Return netQuantityValue as a NUMBER and netQuantityUnit separately.
- Do NOT make any compliance decision.

OCR TEXT:
---
{text}
---

JSON:"""


def _extractWithGemini(text: str) -> dict:
    if not text or len(text.strip()) < 10:
        return {"success": False, "error": "Text too short", "data": {}}

    prompt = EXTRACTION_PROMPT.replace("{text}", text[:100000])
    lastErr = None

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
                lastErr = f"Invalid JSON: {e}"
                break
            except Exception as e:
                lastErr = str(e)
                if "503" in lastErr or "429" in lastErr or "UNAVAILABLE" in lastErr:
                    import time
                    time.sleep(2 ** attempt)
                    continue
                logger.exception("Gemini failed with %s", model)
                break

    return {"success": False, "error": lastErr or "All models failed", "data": {}}


# ============================================================
# NORMALIZATION
# ============================================================
def _cleanDate(v):
    if not v:
        return None
    s = str(v).strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
        return s
    if re.fullmatch(r"\d{4}-\d{2}", s):
        return f"{s}-01"
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


def _cleanPrice(v):
    if v is None:
        return None
    m = re.search(r"(\d+\.?\d*)", str(v))
    if not m:
        return None
    try:
        return float(m.group(1))
    except (TypeError, ValueError):
        return None


def _cleanQuantityValue(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    m = re.search(r"(\d+\.?\d*)", str(v))
    if not m:
        return None
    try:
        return float(m.group(1))
    except (TypeError, ValueError):
        return None


def _standardize(data: dict) -> dict:
    """Clean Gemini's camelCase output. mrp -> float, dates -> ISO."""
    out = {}
    for k, v in (data or {}).items():
        if k == "mrp":
            v = _cleanPrice(v)
        elif k in ("manufacturedDate", "packedDate", "importedDate",
                   "expiryDate", "bestBeforeDate"):
            v = _cleanDate(v)
        elif k == "netQuantityValue":
            v = _cleanQuantityValue(v)
        out[k] = v
    return out


# ============================================================
# ROUTES
# ============================================================
@router.post("/inspect/{inspectionId}")
async def inspectImages(
    inspectionId: str = Path(...),
    db: Session = Depends(get_db),
):
    logger.info(f"{'='*60}")
    logger.info(f"INSPECT START  id={inspectionId}")
    logger.info(f"{'='*60}")

    with Timer(logger, "Load inspection from DB"):
        inspection = db.query(Inspection).filter(Inspection.id == inspectionId).first()
        if not inspection:
            raise HTTPException(404, "Inspection not found")

        images = (
            db.query(Image)
            .filter(Image.inspectionId == inspectionId)
            .order_by(Image.orderNum)
            .all()
        )
        if not images:
            raise HTTPException(400, "No images for this inspection")

        existing = db.query(ExtractedProduct).filter(
            ExtractedProduct.inspectionId == inspectionId
        ).first()
        if existing:
            logger.info(f"Already extracted → returning cached  status={existing.extractionStatus}")
            return {
                "success": True,
                "inspectionId": inspectionId,
                "message": "Already extracted",
                "extractedProductId": existing.id,
                "extractionStatus": existing.extractionStatus,
            }

    logger.info(f"Found {len(images)} image(s) to process")

    processed, failed, textParts = [], [], []
    totalOcrFields = 0

    try:
        # ---------- 1. OCR ----------
        logger.info(f"{'-'*60}")
        logger.info(f"STEP 1 — OCR (PaddleOCR)")
        logger.info(f"{'-'*60}")

        for idx, image in enumerate(images, start=1):
            logger.info(f"  [{idx}/{len(images)}] {image.url}")

            if not os.path.exists(image.url):
                logger.warning(f"    File missing — skipping")
                failed.append({"imageId": image.id, "error": "File missing"})
                continue

            with Timer(logger, f"    PaddleOCR on image {idx}"):
                ocr = extractFromImage(image.url)

            if not ocr.success:
                logger.error(f"    OCR failed: {ocr.error}")
                failed.append({"imageId": image.id, "error": ocr.error})
                continue

            avgConf = ocr.confidence
            logger.info(f"    Extracted {len(ocr.fields)} lines  (avg conf={avgConf:.2f})")
            if VERBOSE:
                for f in ocr.fields[:5]:
                    logger.info(f"      • '{f.value[:60]}'  conf={f.confidence:.2f}  bbox={f.bbox}")
                if len(ocr.fields) > 5:
                    logger.info(f"      … +{len(ocr.fields) - 5} more")

            for idx2, f in enumerate(ocr.fields):
                db.add(Declaration(
                    id=str(uuid.uuid4()),
                    inspectionId=inspectionId,
                    field=f"text_line_{idx2 + 1}",
                    value=f.value,
                    confidence=f.confidence,
                    status="PASS",
                    sourceImageId=image.id,
                    bbox=f.bbox,
                    createdAt=datetime.utcnow(),
                ))

            totalOcrFields += len(ocr.fields)
            textParts.append(ocr.rawText)
            processed.append({
                "imageId": image.id,
                "url": image.url,
                "textCount": len(ocr.fields),
            })

        if not textParts:
            raise HTTPException(400, "No text extracted from any image")

        db.commit()
        logger.info(f"Committed {totalOcrFields} OCR lines to DB")

        # ---------- 2. Gemini ----------
        logger.info(f"{'-'*60}")
        logger.info(f"STEP 2 — Gemini structured extraction")
        logger.info(f"{'-'*60}")

        fullText = " ".join(textParts)
        logger.info(f"Combined OCR text: {len(fullText)} chars")

        extracted = ExtractedProduct(
            id=str(uuid.uuid4()),
            inspectionId=inspectionId,
            rawTextUsed=fullText[:10000],
            extractionStatus="processing",
            createdAt=datetime.utcnow(),
        )
        db.add(extracted)
        db.commit()
        db.refresh(extracted)

        with Timer(logger, "  Gemini call (with retries/fallbacks)"):
            gem = _extractWithGemini(fullText)

        if not gem["success"]:
            logger.error(f"  Gemini failed: {gem.get('error')}")
            extracted.extractionStatus = "failed"
            db.commit()
            raise HTTPException(500, gem.get("error", "Gemini failed"))

        logger.info(f"  Gemini responded via model={gem.get('model')}")

        with Timer(logger, "  Normalize fields"):
            structured = _standardize(gem["data"])

        if VERBOSE:
            logger.info(f"  Extracted fields (camelCase):")
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
            extracted.genericName = structured.get("genericName")
            extracted.commonName = structured.get("commonName")
            extracted.productCategory = structured.get("productCategory")
            extracted.productSubcategory = structured.get("productSubcategory")
            extracted.commodityType = structured.get("commodityType")
            extracted.commodityPhysicalState = structured.get("commodityPhysicalState")
            extracted.manufacturer = structured.get("manufacturer")
            extracted.manufacturerAddress = structured.get("manufacturerAddress")
            extracted.packer = structured.get("packer")
            extracted.packerAddress = structured.get("packerAddress")
            extracted.importer = structured.get("importer")
            extracted.importerAddress = structured.get("importerAddress")
            extracted.countryOfOrigin = structured.get("countryOfOrigin")
            extracted.mrp = structured.get("mrp")
            extracted.mrpCurrency = structured.get("mrpCurrency") or "INR"
            extracted.mrpRawText = structured.get("mrpRawText")
            extracted.netQuantityValue = structured.get("netQuantityValue")
            extracted.netQuantityUnit = structured.get("netQuantityUnit")
            extracted.netQuantityRawText = structured.get("netQuantityRawText")
            extracted.batchNumber = structured.get("batchNumber")
            extracted.manufacturedDate = structured.get("manufacturedDate")
            extracted.packedDate = structured.get("packedDate")
            extracted.importedDate = structured.get("importedDate")
            extracted.expiryDate = structured.get("expiryDate")
            extracted.bestBeforeDate = structured.get("bestBeforeDate")
            extracted.fssaiLicense = structured.get("fssaiLicense")
            extracted.ingredients = structured.get("ingredients")
            extracted.nutritionalInfo = structured.get("nutritionalInfo")
            extracted.storageInstructions = structured.get("storageInstructions")
            extracted.usageInstructions = structured.get("usageInstructions")
            extracted.customerCare = structured.get("customerCare")
            extracted.customerCarePhone = structured.get("customerCarePhone")
            extracted.customerCareEmail = structured.get("customerCareEmail")
            extracted.customerCareAddress = structured.get("customerCareAddress")
            extracted.website = structured.get("website")
            extracted.productCode = structured.get("productCode")
            extracted.declarationLanguage = structured.get("declarationLanguage")
            extracted.declarationOnPdp = structured.get("declarationOnPdp")
            extracted.finishedDimensions = structured.get("finishedDimensions")
            extracted.usableSheetsCount = structured.get("usableSheetsCount")
            extracted.sheetDimensions = structured.get("sheetDimensions")
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
            f"INSPECT DONE  id={inspectionId}  "
            f"status={inspection.status}  fields={len(gem['data'])}"
        )
        logger.info(f"{'='*60}")

        preview = fullText[:300] + ("..." if len(fullText) > 300 else "")

        # ---------- 4. Verification ----------
        logger.info(f"{'-'*60}")
        logger.info(f"STEP 4 — External verification")
        logger.info(f"{'-'*60}")

        with Timer(logger, "  Verify FSSAI / GST"):
            verification = verify_all(structured)

        if VERBOSE:
            for k, v in verification.items():
                logger.info(f"    {k:8s} -> {v['status']:18s} {v['detail'][:60]}")

        # ---------- 5. Rule engine ----------
        logger.info(f"{'-'*60}")
        logger.info(f"STEP 5 — LMPC rule engine")
        logger.info(f"{'-'*60}")

        factsForEngine = dict(structured)
        factsForEngine["saleType"] = getattr(inspection, "saleType", None) or "retail"
        factsForEngine["productCategory"] = (
            factsForEngine.get("productCategory")
            or getattr(inspection, "productCategory", None)
            or "other"
        )
        factsForEngine["inspectionDate"] = (
            inspection.createdAt.date().isoformat()
            if getattr(inspection, "createdAt", None) else None
        )

        fieldConfidence = {k: 0.85 for k, v in structured.items() if v is not None}

        with Timer(logger, "  Evaluate rules"):
            ruleResult = evaluate_rules(
                factsForEngine,
                verification=verification,
                field_confidence=fieldConfidence,
            )

        if VERBOSE:
            logger.info(f"  Overall: {ruleResult['overallStatus']}  "
                        f"(P={ruleResult['summary']['PASS']} "
                        f"F={ruleResult['summary']['FAIL']} "
                        f"U={ruleResult['summary']['UNCERTAIN']} "
                        f"NA={ruleResult['summary']['NOT_APPLICABLE']})")
            for f in ruleResult["findings"]:
                logger.info(f"    [{f['status']:14s}] {f['ruleId']:35s} {f['reason']}")

        inspection.verdict = ruleResult["overallStatus"]
        db.commit()

        return {
            "success": True,
            "inspectionId": inspectionId,
            "totalImages": len(images),
            "processed": processed,
            "failed": failed,
            "totalOcrFields": totalOcrFields,
            "textPreview": preview,
            "extractedProductId": extracted.id,
            "extractionStatus": extracted.extractionStatus,
            "structuredData": structured,
            "verification": verification,
            "ruleEvaluation": ruleResult,
            "status": inspection.status,
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.exception("Inspection failed")
        raise HTTPException(500, f"Inspection failed: {e}")


@router.get("/inspection/{inspectionId}")
async def getInspection(
    inspectionId: str,
    includeDeclarations: bool = Query(False),
    includeExtracted: bool = Query(True),
    db: Session = Depends(get_db),
):
    inspection = db.query(Inspection).filter(Inspection.id == inspectionId).first()
    if not inspection:
        raise HTTPException(404, "Inspection not found")

    images = (
        db.query(Image)
        .filter(Image.inspectionId == inspectionId)
        .order_by(Image.orderNum)
        .all()
    )

    response = {
        "id": inspection.id,
        "productName": inspection.productName,
        "verdict": inspection.verdict,
        "score": inspection.score,
        "status": inspection.status,
        "createdAt": inspection.createdAt,
        "completedAt": inspection.completedAt,
        "imageCount": len(images),
        "images": [
            {"id": i.id, "url": i.url, "order": i.orderNum, "createdAt": i.createdAt}
            for i in images
        ],
    }

    if includeDeclarations:
        decls = db.query(Declaration).filter(Declaration.inspectionId == inspectionId).all()
        response["declarations"] = [
            {
                "id": d.id, "field": d.field, "value": d.value,
                "confidence": d.confidence, "status": d.status,
                "bbox": d.bbox, "createdAt": d.createdAt,
            }
            for d in decls
        ]
        response["declarationCount"] = len(decls)

    if includeExtracted:
        ex = db.query(ExtractedProduct).filter(
            ExtractedProduct.inspectionId == inspectionId
        ).first()
        if ex:
            response["extractedData"] = {
                "id": ex.id,
                "extractionStatus": ex.extractionStatus,
                "confidence": ex.confidenceScore,
                "createdAt": ex.createdAt,
                "updatedAt": ex.updatedAt,
                "data": {
                    "productName": ex.productName,
                    "brand": ex.brand,
                    "genericName": ex.genericName,
                    "commonName": ex.commonName,
                    "productCategory": ex.productCategory,
                    "productSubcategory": ex.productSubcategory,
                    "commodityType": ex.commodityType,
                    "commodityPhysicalState": ex.commodityPhysicalState,
                    "manufacturer": ex.manufacturer,
                    "manufacturerAddress": ex.manufacturerAddress,
                    "packer": ex.packer,
                    "packerAddress": ex.packerAddress,
                    "importer": ex.importer,
                    "importerAddress": ex.importerAddress,
                    "countryOfOrigin": ex.countryOfOrigin,
                    "mrp": ex.mrp,
                    "mrpCurrency": ex.mrpCurrency,
                    "mrpRawText": ex.mrpRawText,
                    "netQuantityValue": ex.netQuantityValue,
                    "netQuantityUnit": ex.netQuantityUnit,
                    "netQuantityRawText": ex.netQuantityRawText,
                    "batchNumber": ex.batchNumber,
                    "manufacturedDate": ex.manufacturedDate,
                    "packedDate": ex.packedDate,
                    "importedDate": ex.importedDate,
                    "expiryDate": ex.expiryDate,
                    "bestBeforeDate": ex.bestBeforeDate,
                    "fssaiLicense": ex.fssaiLicense,
                    "ingredients": ex.ingredients,
                    "nutritionalInfo": ex.nutritionalInfo,
                    "storageInstructions": ex.storageInstructions,
                    "usageInstructions": ex.usageInstructions,
                    "customerCare": ex.customerCare,
                    "customerCarePhone": ex.customerCarePhone,
                    "customerCareEmail": ex.customerCareEmail,
                    "customerCareAddress": ex.customerCareAddress,
                    "website": ex.website,
                    "productCode": ex.productCode,
                    "declarationLanguage": ex.declarationLanguage,
                    "declarationOnPdp": ex.declarationOnPdp,
                    "finishedDimensions": ex.finishedDimensions,
                    "usableSheetsCount": ex.usableSheetsCount,
                    "sheetDimensions": ex.sheetDimensions,
                },
            }

    return response


@router.get("/inspections")
async def getInspections(
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
        rowsC = (
            db.query(Image.inspectionId, func.count(Image.id))
            .filter(Image.inspectionId.in_(ids))
            .group_by(Image.inspectionId)
            .all()
        )
        counts = {c[0]: c[1] for c in rowsC}

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "inspections": [
            {
                "id": r.id,
                "productName": r.productName,
                "verdict": r.verdict,
                "status": r.status,
                "createdAt": r.createdAt,
                "imageCount": counts.get(r.id, 0),
            }
            for r in rows
        ],
    }


@router.delete("/inspection/{inspectionId}")
async def deleteInspection(inspectionId: str, db: Session = Depends(get_db)):
    inspection = db.query(Inspection).filter(Inspection.id == inspectionId).first()
    if not inspection:
        raise HTTPException(404, "Inspection not found")
    try:
        images = db.query(Image).filter(Image.inspectionId == inspectionId).all()
        deleted = 0
        for img in images:
            if os.path.exists(img.url):
                os.remove(img.url)
                deleted += 1
        db.delete(inspection)
        db.commit()
        return {
            "success": True,
            "message": f"Inspection {inspectionId} deleted",
            "deletedImages": deleted,
            "totalImages": len(images),
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Delete failed: {e}")