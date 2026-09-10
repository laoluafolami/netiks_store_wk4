from fastapi import APIRouter

health_router = APIRouter(tags=["health"])


@health_router.get("/health/live")
async def live() -> dict[str, str]:
    return {"status": "live"}


@health_router.get("/health/ready")
async def ready() -> dict[str, str]:
    return {"status": "ready"}

