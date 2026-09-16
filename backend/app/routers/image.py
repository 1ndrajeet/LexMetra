# backend/app/routers/images.py
"""
Image router for LEXMETRA.
Serves uploaded inspection images as static files.

URL shape:  GET /api/v1/image/{imageId}
Lookup:     Image.id (uuid) -> Image.url (relative path under uploads/)
Serving:    FileResponse with content-type, cache headers, ETag.

Also supports:
  GET /api/v1/image/by-inspection/{inspectionId}   -> list of image URLs for an inspection
  GET /api/v1/image/raw/{filename}                 -> direct filename (whitelisted)
"""
from __future__ import annotations

import logging
import os
import mimetypes
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path as PathParam
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session

from app.lib.db import get_db
from app.lib.models import Image

logger = logging.getLogger("lexmetra.images")

router = APIRouter(tags=["images"])

# Resolve the uploads root the same way upload.py does, but absolutely.
# upload.py stores urls as "uploads/<file>.<ext>" relative to CWD.
BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent  # backend/
UPLOAD_ROOT = (BACKEND_ROOT / "uploads").resolve()

ALLOWED_EXTENSIONS = {".jpeg", ".jpg", ".png", ".bmp", ".tiff", ".webp"}


def _safe_path_from_url(url: str) -> Path:
    """
    Convert a stored Image.url (e.g. "uploads/abc.jpg") into an absolute
    path, rejecting anything that escapes UPLOAD_ROOT.
    """
    # Normalise: strip leading "./" or "/" and "uploads/" prefix
    raw = url.strip()
    if raw.startswith("./"):
        raw = raw[2:]
    if raw.startswith("/"):
        raw = raw[1:]

    # If the stored url already starts with "uploads/", strip it so we
    # can join it against UPLOAD_ROOT without doubling.
    if raw.startswith("uploads/"):
        raw = raw[len("uploads/"):]

    # Reject any path component that tries to walk up
    candidate = (UPLOAD_ROOT / raw).resolve()
    try:
        candidate.relative_to(UPLOAD_ROOT)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid image path")

    # Extension whitelist
    if candidate.suffix.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported image type")

    return candidate


def _file_response(path: Path) -> FileResponse:
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Image file not found")

    stat = path.stat()
    media_type, _ = mimetypes.guess_type(str(path))
    media_type = media_type or "application/octet-stream"

    # ETag = mtime + size. Cheap and stable.
    etag = f'"{int(stat.st_mtime)}-{stat.st_size}"'

    return FileResponse(
        path=str(path),
        media_type=media_type,
        headers={
            "Cache-Control": "public, max-age=86400, immutable",
            "ETag": etag,
            "Content-Length": str(stat.st_size),
        },
    )


# ============================================================
# Primary route: by Image.id
# ============================================================
@router.get("/image/{image_id}")
async def get_image(
    image_id: str = PathParam(..., description="Image.id"),
    db: Session = Depends(get_db),
):
    """
    Serve the uploaded image identified by its database id.
    """
    img: Optional[Image] = (
        db.query(Image).filter(Image.id == image_id).first()
    )
    if img is None:
        raise HTTPException(status_code=404, detail="Image not found")

    try:
        path = _safe_path_from_url(img.url)
    except HTTPException:
        raise

    logger.debug("Serving image id=%s -> %s", image_id, path)
    return _file_response(path)


# ============================================================
# List images for an inspection (returns URLs, not bytes)
# ============================================================
@router.get("/image/by-inspection/{inspection_id}")
async def list_inspection_images(
    inspection_id: str = PathParam(..., description="Inspection.id"),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Image)
        .filter(Image.inspectionId == inspection_id)
        .order_by(Image.orderNum)
        .all()
    )
    return {
        "inspectionId": inspection_id,
        "count": len(rows),
        "images": [
            {
                "id": r.id,
                "order": r.orderNum,
                "url": f"/api/v1/image/{r.id}",
                "createdAt": r.createdAt.isoformat() if r.createdAt else None,
            }
            for r in rows
        ],
    }


# ============================================================
# Direct filename access (for diagnostics only; whitelisted)
# ============================================================
@router.get("/image/raw/{filename}")
async def get_image_raw(filename: str = PathParam(...)):
    """
    Fetch by raw filename. Whitelisted to filenames with allowed
    extensions under UPLOAD_ROOT. Useful for debugging when you have
    a URL from logs but not the Image.id.
    """
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    if Path(filename).suffix.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported image type")

    path = (UPLOAD_ROOT / filename).resolve()
    try:
        path.relative_to(UPLOAD_ROOT)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")

    return _file_response(path)