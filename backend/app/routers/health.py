# backend/app/routes/health.py
from fastapi import APIRouter
from app import APP_NAME, APP_VERSION

router = APIRouter(tags=["health"])

@router.get("/health")
async def health():
    return {"status": "ok", "service": APP_NAME, "version": APP_VERSION}