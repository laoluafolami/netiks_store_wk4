from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Store


def get_store_by_owner_id(session: Session, owner_id: str) -> Store | None:
    return session.execute(select(Store).where(Store.owner_id == owner_id)).scalar_one_or_none()


def get_store_by_slug(session: Session, slug: str) -> Store | None:
    return session.execute(select(Store).where(Store.slug == slug)).scalar_one_or_none()


def get_store_by_id(session: Session, store_id: str) -> Store | None:
    return session.execute(select(Store).where(Store.id == store_id)).scalar_one_or_none()


def list_active_stores(session: Session) -> list[Store]:
    statement = select(Store).where(Store.status == "active").order_by(Store.created_at.desc())
    return list(session.execute(statement).scalars().all())


def create_store(session: Session, store: Store) -> Store:
    session.add(store)
    session.commit()
    session.refresh(store)
    return store


def update_store(session: Session, store: Store) -> Store:
    session.add(store)
    session.commit()
    session.refresh(store)
    return store
