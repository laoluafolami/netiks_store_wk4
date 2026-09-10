import httpx
from fastapi import HTTPException, status

from app.config import Settings

settings = Settings()


async def verify_store_ownership(store_id: str, owner_id: str) -> None:
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(f"{settings.vendor_service_url}/internal/stores/{store_id}")

    if response.status_code == status.HTTP_404_NOT_FOUND:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
    if response.is_error:
        raise HTTPException(status_code=response.status_code, detail="Unable to verify store ownership")

    store = response.json()["data"]
    if store["owner_id"] != owner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Store does not belong to the current user",
        )
    if store["status"] != "active":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Store is not active")
