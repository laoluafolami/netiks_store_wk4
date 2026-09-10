from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Category, Order, Product


def list_categories(session: Session) -> list[Category]:
    return list(session.execute(select(Category).order_by(Category.name.asc())).scalars().all())


def get_category_by_slug(session: Session, slug: str) -> Category | None:
    return session.execute(select(Category).where(Category.slug == slug)).scalar_one_or_none()


def get_category_by_id(session: Session, category_id: str) -> Category | None:
    return session.execute(select(Category).where(Category.id == category_id)).scalar_one_or_none()


def create_category(session: Session, category: Category) -> Category:
    session.add(category)
    session.commit()
    session.refresh(category)
    return category


def list_published_products(session: Session) -> list[Product]:
    statement = select(Product).where(Product.status == "published").order_by(Product.created_at.desc())
    return list(session.execute(statement).scalars().all())


def list_products_by_owner(session: Session, owner_id: str) -> list[Product]:
    statement = select(Product).where(Product.owner_id == owner_id).order_by(Product.created_at.desc())
    return list(session.execute(statement).scalars().all())


def get_product_by_slug(session: Session, slug: str) -> Product | None:
    return session.execute(select(Product).where(Product.slug == slug)).scalar_one_or_none()


def get_product_by_id(session: Session, product_id: str) -> Product | None:
    return session.execute(select(Product).where(Product.id == product_id)).scalar_one_or_none()


def get_product_by_id_for_update(session: Session, product_id: str) -> Product | None:
    statement = select(Product).where(Product.id == product_id).with_for_update()
    return session.execute(statement).scalar_one_or_none()


def create_product(session: Session, product: Product) -> Product:
    session.add(product)
    session.commit()
    session.refresh(product)
    return product


def update_product(session: Session, product: Product) -> Product:
    session.add(product)
    session.commit()
    session.refresh(product)
    return product


def create_order(session: Session, order: Order) -> Order:
    session.add(order)
    session.commit()
    session.refresh(order)
    return order


def list_orders_by_owner(session: Session, owner_id: str) -> list[Order]:
    statement = select(Order).where(Order.owner_id == owner_id).order_by(Order.created_at.desc())
    return list(session.execute(statement).scalars().all())
