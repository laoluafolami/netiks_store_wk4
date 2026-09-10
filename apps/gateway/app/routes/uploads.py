from fastapi import APIRouter, File, Header, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse
import httpx

from app.config import Settings
from app.deps import get_user_context

router = APIRouter(tags=["uploads"])
settings = Settings()


@router.post("/uploads")
async def upload_file(
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None),
) -> dict:
    await get_user_context(authorization)

    file_bytes = await file.read()
    files = {
        "file": (
            file.filename or "upload.bin",
            file_bytes,
            file.content_type or "application/octet-stream",
        )
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(f"{settings.media_service_url}/uploads", files=files)

    if response.is_error:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    return JSONResponse(status_code=response.status_code, content=response.json())
