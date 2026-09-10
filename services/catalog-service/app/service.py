from decimal import Decimal
from secrets import randbelow

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Category, Order, Product
from app.repository import (
    create_order,
    create_category,
    create_product,
    get_category_by_id,
    get_category_by_slug,
    get_product_by_id,
    get_product_by_id_for_update,
    get_product_by_slug,
    list_orders_by_owner,
    list_categories,
    list_products_by_owner,
    list_published_products,
    update_product,
)
from app.schemas import CategoryCreate, CheckoutCreate, ProductCreate, ProductUpdate


def list_categories_service(session: Session) -> list[Category]:
    return list_categories(session)


def create_category_service(session: Session, payload: CategoryCreate) -> Category:
    if get_category_by_slug(session, payload.slug):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category slug already exists")

    category = Category(
        name=payload.name.strip(),
        slug=payload.slug.strip().lower(),
        description=payload.description.strip() if payload.description else None,
    )
    return create_category(session, category)


def list_products_service(session: Session, owner_id: str | None = None) -> list[Product]:
    if owner_id:
        return list_products_by_owner(session, owner_id)
    return list_published_products(session)


def get_product_by_slug_service(session: Session, slug: str, owner_id: str | None = None) -> Product:
    product = get_product_by_slug(session, slug)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    if product.status != "published" and product.owner_id != owner_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


def create_product_service(session: Session, owner_id: str, payload: ProductCreate) -> Product:
    if get_product_by_slug(session, payload.slug):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product slug already exists")
    if not get_category_by_id(session, payload.category_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    product = Product(
        store_id=payload.store_id,
        owner_id=owner_id,
        category_id=payload.category_id,
        name=payload.name.strip(),
        slug=payload.slug.strip().lower(),
        description=payload.description.strip(),
        price=Decimal(payload.price),
        currency=payload.currency.upper(),
        stock_quantity=payload.stock_quantity,
        sold_quantity=payload.sold_quantity,
        sku=payload.sku.strip(),
        status=payload.status,
        featured_image_url=payload.featured_image_url,
    )
    return create_product(session, product)


def update_product_service(session: Session, product_id: str, owner_id: str, payload: ProductUpdate) -> Product:
    product = get_product_by_id(session, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    if product.owner_id != owner_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to update this product")

    if payload.category_id is not None and not get_category_by_id(session, payload.category_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    for field in ("name", "description", "currency", "sku", "status", "featured_image_url", "category_id"):
        value = getattr(payload, field)
        if value is not None:
            setattr(product, field, value.strip() if isinstance(value, str) else value)

    if payload.price is not None:
        product.price = Decimal(payload.price)
    if payload.stock_quantity is not None:
        product.stock_quantity = payload.stock_quantity
    if payload.currency is not None:
        product.currency = payload.currency.upper()

    return update_product(session, product)


def list_orders_service(session: Session, owner_id: str) -> list[Order]:
    return list_orders_by_owner(session, owner_id)


def checkout_product_service(session: Session, payload: CheckoutCreate) -> Order:
    product = get_product_by_id_for_update(session, payload.product_id)
    if not product or product.status != "published":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    if payload.quantity > product.stock_quantity:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Not enough stock remaining")

    quantity = payload.quantity
    unit_price = Decimal(product.price)
    total_price = unit_price * quantity
    product.stock_quantity -= quantity
    product.sold_quantity += quantity
    session.add(product)

    order = Order(
        product_id=product.id,
        store_id=product.store_id,
        owner_id=product.owner_id,
        buyer_name=payload.buyer_name.strip(),
        buyer_email=payload.buyer_email.strip().lower(),
        buyer_phone=payload.buyer_phone.strip() if payload.buyer_phone else None,
        shipping_address=payload.shipping_address.strip(),
        quantity=quantity,
        unit_price=unit_price,
        total_price=total_price,
        payment_method=f"{payload.payment_method}-ending-{payload.payment_last4}",
        payment_reference=f"DEMO-{randbelow(900000) + 100000}",
        status="paid",
    )
    session.add(order)
    session.commit()
    session.refresh(order)
    return order
