from fastapi import APIRouter

from app.config import Settings

router = APIRouter(tags=["system"])
settings = Settings()


@router.get("/system/services")
async def list_services() -> dict[str, object]:
    return {
        "data": {
            "gateway": settings.app_name,
            "services": [
                "identity-service",
                "vendor-service",
                "catalog-service",
                "media-service",
                "admin-service",
            ],
        }
    }

