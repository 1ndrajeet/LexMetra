from fastapi import APIRouter
from app.routers.health import router as health_router
from app.routers.upload import router as upload_router
from app.routers.inspection import router as inspection_router
from app.routers.image import router as images_router

router = APIRouter()
router.include_router(health_router,     prefix="/api/v1", tags=["health"])
router.include_router(upload_router,     prefix="/api/v1", tags=["upload"])
router.include_router(inspection_router, prefix="/api/v1", tags=["inspection"])
router.include_router(images_router, prefix="/api/v1", tags=["images"])