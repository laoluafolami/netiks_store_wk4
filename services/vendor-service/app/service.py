from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Store
from app.repository import (
    create_store,
    get_store_by_id,
    get_store_by_owner_id,
    get_store_by_slug,
    list_active_stores,
    update_store,
)
from app.schemas import StoreCreate, StoreUpdate


def list_stores_service(session: Session) -> list[Store]:
    return list_active_stores(session)


def get_store_by_slug_service(session: Session, slug: str) -> Store:
    store = get_store_by_slug(session, slug)
    if not store or store.status != "active":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
    return store


def get_store_by_owner_service(session: Session, owner_id: str) -> Store:
    store = get_store_by_owner_id(session, owner_id)
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
    return store


def get_store_by_id_service(session: Session, store_id: str) -> Store:
    store = get_store_by_id(session, store_id)
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
    return store


def create_store_service(session: Session, owner_id: str, payload: StoreCreate) -> Store:
    if get_store_by_owner_id(session, owner_id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Owner already has a store")
    if get_store_by_slug(session, payload.slug):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Store slug already exists")

    store = Store(
        owner_id=owner_id,
        name=payload.name.strip(),
        slug=payload.slug.strip().lower(),
        description=payload.description.strip(),
        contact_email=str(payload.contact_email).lower(),
        phone=payload.phone,
        logo_url=payload.logo_url,
        banner_url=payload.banner_url,
        status="active",
    )
    return create_store(session, store)


def update_store_service(session: Session, store_id: str, owner_id: str, payload: StoreUpdate) -> Store:
    store = get_store_by_id(session, store_id)
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
    if store.owner_id != owner_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to update this store")

    for field in ("name", "description", "phone", "logo_url", "banner_url", "status"):
        value = getattr(payload, field)
        if value is not None:
            setattr(store, field, value.strip() if isinstance(value, str) else value)

    if payload.contact_email is not None:
        store.contact_email = str(payload.contact_email).lower()

    return update_store(session, store)
