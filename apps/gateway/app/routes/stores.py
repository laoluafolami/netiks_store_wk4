from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
import httpx

from app.config import Settings
from app.deps import extract_user_context_from_request

router = APIRouter(tags=["stores"])
settings = Settings()


def _proxy_json_response(response: httpx.Response) -> JSONResponse:
    return JSONResponse(status_code=response.status_code, content=response.json())


@router.get("/stores")
async def list_stores() -> dict:
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(f"{settings.vendor_service_url}/stores")
    if response.is_error:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return _proxy_json_response(response)


@router.post("/stores")
async def create_store(request: Request) -> dict:
    payload = await request.json()
    user = await extract_user_context_from_request(request)
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            f"{settings.vendor_service_url}/stores",
            json=payload,
            headers={"x-user-id": user["id"]},
        )
    if response.is_error:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return _proxy_json_response(response)


@router.get("/stores/{slug}")
async def get_store(slug: str) -> dict:
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(f"{settings.vendor_service_url}/stores/{slug}")
    if response.is_error:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return _proxy_json_response(response)


@router.get("/vendors/me/store")
async def get_my_store(request: Request) -> dict:
    user = await extract_user_context_from_request(request)
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{settings.vendor_service_url}/vendors/me/store",
            headers={"x-user-id": user["id"]},
        )
    if response.is_error:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return _proxy_json_response(response)


@router.patch("/stores/{store_id}")
async def update_store(store_id: str, request: Request) -> dict:
    payload = await request.json()
    user = await extract_user_context_from_request(request)
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.patch(
            f"{settings.vendor_service_url}/stores/{store_id}",
            json=payload,
            headers={"x-user-id": user["id"]},
        )
    if response.is_error:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return _proxy_json_response(response)
