from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db_session
from app.schemas import StoreCreate, StoreResponse, StoreUpdate
from app.service import (
    create_store_service,
    get_store_by_id_service,
    get_store_by_owner_service,
    get_store_by_slug_service,
    list_stores_service,
    update_store_service,
)

router = APIRouter(tags=["stores"])


def require_user_id(x_user_id: str | None) -> str:
    if not x_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing user context")
    return x_user_id


def to_store_response(store) -> dict[str, str | None]:
    return StoreResponse.model_validate(store, from_attributes=True).model_dump()


@router.get("/stores")
async def list_stores(session: Session = Depends(get_db_session)) -> dict[str, object]:
    return {"data": [to_store_response(store) for store in list_stores_service(session)]}


@router.post("/stores", status_code=status.HTTP_201_CREATED)
async def create_store(
    payload: StoreCreate,
    session: Session = Depends(get_db_session),
    x_user_id: str | None = Header(default=None),
) -> dict[str, object]:
    store = create_store_service(session, require_user_id(x_user_id), payload)
    return {"data": to_store_response(store)}


@router.get("/stores/{slug}")
async def get_store(slug: str, session: Session = Depends(get_db_session)) -> dict[str, object]:
    return {"data": to_store_response(get_store_by_slug_service(session, slug))}


@router.get("/vendors/me/store")
async def get_my_store(
    session: Session = Depends(get_db_session),
    x_user_id: str | None = Header(default=None),
) -> dict[str, object]:
    return {"data": to_store_response(get_store_by_owner_service(session, require_user_id(x_user_id)))}


@router.get("/internal/stores/{store_id}")
async def get_store_by_id_internal(store_id: str, session: Session = Depends(get_db_session)) -> dict[str, object]:
    return {"data": to_store_response(get_store_by_id_service(session, store_id))}


@router.patch("/stores/{store_id}")
async def update_store(
    store_id: str,
    payload: StoreUpdate,
    session: Session = Depends(get_db_session),
    x_user_id: str | None = Header(default=None),
) -> dict[str, object]:
    store = update_store_service(session, store_id, require_user_id(x_user_id), payload)
    return {"data": to_store_response(store)}
