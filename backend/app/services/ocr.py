# backend/app/services/ocr.py
"""OCR service: image -> list of text lines with bounding boxes."""
from __future__ import annotations
import logging
from dataclasses import dataclass
from typing import List, Optional
import numpy as np
import cv2

logger = logging.getLogger(__name__)

_reader = None


@dataclass
class OcrLine:
    text: str
    confidence: float
    bbox: tuple[int, int, int, int]  # x, y, w, h


@dataclass
class OcrResult:
    success: bool
    lines: List[OcrLine]
    raw_text: str
    error: Optional[str] = None


def _get_reader():
    global _reader
    if _reader is None:
        from paddleocr import PaddleOCR
        try:
            _reader = PaddleOCR(
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
                lang="en",
            )
        except TypeError:
            _reader = PaddleOCR(use_angle_cls=False, lang="en", show_log=False)
    return _reader


def _parse_v3(result) -> List[OcrLine]:
    """PaddleOCR 3.x returns a list of dict-like result objects."""
    lines: List[OcrLine] = []
    for page in result or []:
        data = getattr(page, "json", None)
        if callable(data):
            data = data()
        if isinstance(data, dict):
            data = data.get("res", data)
        if not isinstance(data, dict):
            if isinstance(page, dict):
                data = page.get("res", page)
            else:
                continue

        texts = data.get("rec_texts") or []
        scores = data.get("rec_scores") or []
        boxes = data.get("rec_boxes") or data.get("rec_polys") or []

        for i, text in enumerate(texts):
            text = str(text).strip()
            if not text or i >= len(boxes):
                continue
            pts = np.asarray(boxes[i], dtype=np.float32).reshape(-1, 2)
            x, y, w, h = cv2.boundingRect(pts)
            try:
                score = float(scores[i]) if i < len(scores) else 0.0
            except (TypeError, ValueError):
                score = 0.0
            lines.append(OcrLine(text=text, confidence=max(0.0, min(1.0, score)),
                                 bbox=(int(x), int(y), int(w), int(h))))
    return lines


def _parse_v2(result) -> List[OcrLine]:
    """PaddleOCR 2.x returns [[ [pts, (text, score)], ... ]]."""
    lines: List[OcrLine] = []
    for page in result or []:
        for entry in page or []:
            try:
                pts, (text, score) = entry
            except (TypeError, ValueError):
                continue
            text = str(text).strip()
            if not text:
                continue
            arr = np.asarray(pts, dtype=np.float32)
            x, y, w, h = cv2.boundingRect(arr)
            lines.append(OcrLine(text=text, confidence=max(0.0, min(1.0, float(score))),
                                 bbox=(int(x), int(y), int(w), int(h))))
    return lines


def extract_from_image(image_path: str) -> OcrResult:
    """Run PaddleOCR on an image file, return text lines in reading order."""
    try:
        img = cv2.imread(image_path)
        if img is None:
            return OcrResult(False, [], "", f"Cannot read image: {image_path}")

        reader = _get_reader()
        result = reader.ocr(img)
        if not result:
            return OcrResult(True, [], "", None)

        # Detect API version by trying v3 shape first
        lines = _parse_v3(result)
        if not lines:
            lines = _parse_v2(result)

        lines.sort(key=lambda l: (l.bbox[1], l.bbox[0]))
        raw = "\n".join(l.text for l in lines)
        return OcrResult(True, lines, raw, None)

    except Exception as e:
        logger.exception("OCR failed for %s", image_path)
        return OcrResult(False, [], "", str(e))