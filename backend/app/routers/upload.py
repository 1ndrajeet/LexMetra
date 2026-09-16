# backend/app/routers/upload.py
"""
Upload router for LEXMETRA.
Handles multiple file uploads and creates inspection records.
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from sqlalchemy.orm import Session
from datetime import datetime
import shutil
import uuid
import os
from typing import List, Optional
import logging

from app.lib.db import get_db
from app.lib.models import Inspection, Image

logger = logging.getLogger(__name__)

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {".jpeg", ".jpg", ".png", ".bmp", ".tiff", ".webp"}
MAX_FILES_PER_BATCH = 10


def validate_file(file: UploadFile) -> tuple[str, str]:
    """Validate uploaded file type."""
    file_extension = os.path.splitext(file.filename)[1].lower()
    if file_extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed: {file.filename}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Generate unique filename
    file_id = str(uuid.uuid4())
    return file_id, file_extension


@router.post("/upload")
async def upload_files(
    files: List[UploadFile] = File(..., description="Multiple image files to upload"),
    product_name: Optional[str] = Form(None, description="Optional product name"),
    db: Session = Depends(get_db)
):
    """
    Upload multiple image files for inspection.
    Creates an inspection record and stores all images.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    
    if len(files) > MAX_FILES_PER_BATCH:
        raise HTTPException(
            status_code=400,
            detail=f"Too many files. Maximum {MAX_FILES_PER_BATCH} files per batch"
        )
    
    # Create inspection record first
    inspection_id = str(uuid.uuid4())
    inspection = Inspection(
        id=inspection_id,
        userId=None,  # Will be set when auth is implemented
        productName=product_name or "Unknown Product",
        verdict="PENDING",
        score=None,
        status="processing",
        createdAt=datetime.utcnow(),
        completedAt=None
    )
    db.add(inspection)
    db.commit()
    db.refresh(inspection)
    
    uploaded_files = []
    failed_files = []
    
    try:
        for idx, file in enumerate(files):
            try:
                # Validate and generate path
                file_id, file_extension = validate_file(file)
                file_path = os.path.join(UPLOAD_DIR, f"{file_id}{file_extension}")
                
                # Save file with size check
                file_size = 0
                with open(file_path, "wb") as buffer:
                    while chunk := await file.read(8192):
                        file_size += len(chunk)
                        if file_size > MAX_FILE_SIZE:
                            buffer.close()
                            os.remove(file_path)
                            raise HTTPException(
                                status_code=400,
                                detail=f"File too large: {file.filename}. Max size: {MAX_FILE_SIZE / 1024 / 1024:.1f}MB"
                            )
                        buffer.write(chunk)
                
                # Create image record
                image = Image(
                    id=file_id,
                    inspectionId=inspection_id,
                    url=file_path,
                    orderNum=idx + 1,
                    createdAt=datetime.utcnow()
                )
                db.add(image)
                
                uploaded_files.append({
                    "id": file_id,
                    "filename": file.filename,
                    "url": file_path,
                    "order": idx + 1,
                    "size": file_size
                })
                
            except Exception as e:
                failed_files.append({
                    "filename": file.filename,
                    "error": str(e)
                })
                continue
        
        # Commit all image records
        db.commit()
        
        # Update inspection status
        if uploaded_files:
            inspection.status = "completed" if not failed_files else "partial"
            db.commit()
        
        return {
            "success": True,
            "inspection_id": inspection_id,
            "product_name": inspection.productName,
            "total_files": len(files),
            "uploaded": uploaded_files,
            "failed": failed_files,
            "status": inspection.status,
            "created_at": inspection.createdAt.isoformat()
        }
        
    except Exception as e:
        db.rollback()
        # Clean up any uploaded files
        for uploaded in uploaded_files:
            try:
                os.remove(uploaded["url"])
            except:
                pass
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/upload/{inspection_id}")
async def get_upload_status(
    inspection_id: str,
    db: Session = Depends(get_db)
):
    """Get upload status and details for an inspection."""
    inspection = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    images = db.query(Image).filter(Image.inspectionId == inspection_id).all()
    
    return {
        "id": inspection.id,
        "product_name": inspection.productName,
        "verdict": inspection.verdict,
        "status": inspection.status,
        "created_at": inspection.createdAt,
        "completed_at": inspection.completedAt,
        "image_count": len(images),
        "images": [
            {
                "id": img.id,
                "url": img.url,
                "order": img.orderNum,
                "created_at": img.createdAt
            }
            for img in images
        ]
    }


@router.delete("/upload/{inspection_id}")
async def delete_upload(
    inspection_id: str,
    db: Session = Depends(get_db)
):
    """Delete an inspection and all associated uploaded files."""
    inspection = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    try:
        # Get all images to delete files
        images = db.query(Image).filter(Image.inspectionId == inspection_id).all()
        
        # Delete physical files
        deleted_count = 0
        for image in images:
            if os.path.exists(image.url):
                os.remove(image.url)
                deleted_count += 1
        
        # Delete database records (cascade will handle related records)
        db.delete(inspection)
        db.commit()
        
        return {
            "success": True,
            "message": f"Inspection {inspection_id} deleted successfully",
            "deleted_images": deleted_count,
            "total_images": len(images)
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")