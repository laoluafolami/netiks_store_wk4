from mimetypes import guess_type

from fastapi import FastAPI, File, UploadFile, status
from fastapi.responses import FileResponse

from app.service import list_uploads, resolve_upload, save_upload
from netiks_shared.health import health_router

app = FastAPI(title="Netiks Store Media Service", version="0.1.0")

app.include_router(health_router)


@app.get("/media")
async def list_media() -> dict[str, object]:
    return {"data": list_uploads()}


@app.post("/uploads", status_code=status.HTTP_201_CREATED)
async def upload_media(file: UploadFile = File(...)) -> dict[str, object]:
    return {"data": await save_upload(file)}


@app.get("/media/{file_id}")
async def get_media(file_id: str) -> FileResponse:
    path = resolve_upload(file_id)
    media_type, _ = guess_type(path.name)
    return FileResponse(path, media_type=media_type or "application/octet-stream", filename=path.name)
