from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import JSONResponse
import httpx

from app.config import Settings

router = APIRouter(prefix="/auth", tags=["auth"])
settings = Settings()


def _proxy_json_response(response: httpx.Response) -> JSONResponse:
    return JSONResponse(status_code=response.status_code, content=response.json())


@router.post("/register")
async def register(request: Request) -> dict:
    payload = await request.json()
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(f"{settings.identity_service_url}/auth/register", json=payload)

    if response.is_error:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    return _proxy_json_response(response)


@router.post("/login")
async def login(request: Request) -> dict:
    payload = await request.json()
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(f"{settings.identity_service_url}/auth/login", json=payload)

    if response.is_error:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    return _proxy_json_response(response)


@router.post("/refresh")
async def refresh(request: Request) -> dict:
    payload = await request.json()
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(f"{settings.identity_service_url}/auth/refresh", json=payload)

    if response.is_error:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    return _proxy_json_response(response)


@router.get("/me")
async def me(request: Request) -> dict:
    authorization = request.headers.get("Authorization")
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

    return _proxy_json_response(response)
