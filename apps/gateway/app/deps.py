from fastapi import HTTPException, Request, status
import httpx

from app.config import Settings

settings = Settings()


async def get_user_context(authorization: str | None) -> dict[str, str]:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{settings.identity_service_url}/auth/me",
            headers={"Authorization": authorization},
        )

    if response.is_error:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    return response.json()["data"]


async def extract_user_context_from_request(request: Request) -> dict[str, str]:
    return await get_user_context(request.headers.get("Authorization"))
