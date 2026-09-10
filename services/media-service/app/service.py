from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from app.config import Settings

settings = Settings()
allowed_content_types = {"image/jpeg", "image/png", "image/webp"}


def ensure_upload_dir() -> Path:
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


async def save_upload(file: UploadFile) -> dict[str, object]:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Filename is required")

    content_type = file.content_type or "application/octet-stream"
    if content_type not in allowed_content_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Allowed: jpeg, png, webp",
        )

    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large")

    upload_dir = ensure_upload_dir()
    suffix = Path(file.filename).suffix.lower() or ".bin"
    stored_name = f"{uuid4()}{suffix}"
    destination = upload_dir / stored_name
    destination.write_bytes(content)

    return {
        "id": stored_name,
        "filename": file.filename,
        "content_type": content_type,
        "size": len(content),
        "url": f"/media/{stored_name}",
    }


def list_uploads() -> list[dict[str, object]]:
    upload_dir = ensure_upload_dir()
    items: list[dict[str, object]] = []
    for path in sorted(upload_dir.iterdir(), reverse=True):
        if path.is_file():
            items.append(
                {
                    "id": path.name,
                    "filename": path.name,
                    "size": path.stat().st_size,
                    "url": f"/media/{path.name}",
                }
            )
    return items


def resolve_upload(file_id: str) -> Path:
    path = ensure_upload_dir() / file_id
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return path
