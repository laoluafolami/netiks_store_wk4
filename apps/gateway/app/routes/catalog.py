from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
import httpx

from app.config import Settings
from app.deps import extract_user_context_from_request

router = APIRouter(tags=["catalog"])
settings = Settings()


def _proxy_json_response(response: httpx.Response) -> JSONResponse:
    return JSONResponse(status_code=response.status_code, content=response.json())


@router.get("/categories")
async def list_categories() -> dict:
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(f"{settings.catalog_service_url}/categories")
    if response.is_error:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return _proxy_json_response(response)


@router.post("/categories")
async def create_category(request: Request) -> dict:
    payload = await request.json()
    user = await extract_user_context_from_request(request)
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            f"{settings.catalog_service_url}/categories",
            json=payload,
            headers={"x-user-id": user["id"]},
        )
    if response.is_error:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return _proxy_json_response(response)


@router.get("/products")
async def list_products(request: Request) -> dict:
    mine = request.query_params.get("mine")
    headers: dict[str, str] = {}
    query = ""
    if mine == "true":
        user = await extract_user_context_from_request(request)
        headers["x-user-id"] = user["id"]
        query = f"?{urlencode({'mine': 'true'})}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(f"{settings.catalog_service_url}/products{query}", headers=headers)
    if response.is_error:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return _proxy_json_response(response)


@router.post("/products")
async def create_product(request: Request) -> dict:
    payload = await request.json()
    user = await extract_user_context_from_request(request)
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            f"{settings.catalog_service_url}/products",
            json=payload,
            headers={"x-user-id": user["id"]},
        )
    if response.is_error:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return _proxy_json_response(response)


@router.get("/products/{slug}")
async def get_product(slug: str, request: Request) -> dict:
    headers: dict[str, str] = {}
    authorization = request.headers.get("Authorization")
    if authorization:
        user = await extract_user_context_from_request(request)
        headers["x-user-id"] = user["id"]
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(f"{settings.catalog_service_url}/products/{slug}", headers=headers)
    if response.is_error:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return _proxy_json_response(response)


@router.patch("/products/{product_id}")
async def update_product(product_id: str, request: Request) -> dict:
    payload = await request.json()
    user = await extract_user_context_from_request(request)
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.patch(
            f"{settings.catalog_service_url}/products/{product_id}",
            json=payload,
            headers={"x-user-id": user["id"]},
        )
    if response.is_error:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return _proxy_json_response(response)


@router.post("/checkout")
async def checkout_product(request: Request) -> dict:
    payload = await request.json()
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            f"{settings.catalog_service_url}/checkout",
            json=payload,
        )
    if response.is_error:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return _proxy_json_response(response)


@router.get("/orders")
async def list_orders(request: Request) -> dict:
    mine = request.query_params.get("mine")
    if mine != "true":
        raise HTTPException(status_code=400, detail="Only vendor order listing is supported")

    user = await extract_user_context_from_request(request)
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{settings.catalog_service_url}/orders?{urlencode({'mine': 'true'})}",
            headers={"x-user-id": user["id"]},
        )
    if response.is_error:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return _proxy_json_response(response)
