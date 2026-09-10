from decimal import Decimal

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db_session
from app.schemas import (
    CategoryCreate,
    CategoryResponse,
    CheckoutCreate,
    OrderResponse,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
)
from app.service import (
    checkout_product_service,
    create_category_service,
    create_product_service,
    get_product_by_slug_service,
    list_orders_service,
    list_categories_service,
    list_products_service,
    update_product_service,
)
from app.vendor_client import verify_store_ownership

router = APIRouter(tags=["catalog"])


def require_user_id(x_user_id: str | None) -> str:
    if not x_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing user context")
    return x_user_id


def to_category_response(category) -> dict[str, str | None]:
    return CategoryResponse.model_validate(category, from_attributes=True).model_dump()


def to_product_response(product) -> dict[str, str | int | None]:
    return ProductResponse(
        id=product.id,
        store_id=product.store_id,
        owner_id=product.owner_id,
        category_id=product.category_id,
        name=product.name,
        slug=product.slug,
        description=product.description,
        price=f"{Decimal(product.price):.2f}",
        currency=product.currency,
        stock_quantity=product.stock_quantity,
        sold_quantity=product.sold_quantity,
        sku=product.sku,
        status=product.status,
        featured_image_url=product.featured_image_url,
    ).model_dump()


def to_order_response(order) -> dict[str, str | int | None]:
    return OrderResponse(
        id=order.id,
        product_id=order.product_id,
        store_id=order.store_id,
        owner_id=order.owner_id,
        buyer_name=order.buyer_name,
        buyer_email=order.buyer_email,
        buyer_phone=order.buyer_phone,
        shipping_address=order.shipping_address,
        quantity=order.quantity,
        unit_price=f"{Decimal(order.unit_price):.2f}",
        total_price=f"{Decimal(order.total_price):.2f}",
        payment_method=order.payment_method,
        payment_reference=order.payment_reference,
        status=order.status,
        created_at=order.created_at.isoformat(),
    ).model_dump()


@router.get("/categories")
async def list_categories(session: Session = Depends(get_db_session)) -> dict[str, object]:
    return {"data": [to_category_response(item) for item in list_categories_service(session)]}


@router.post("/categories", status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate,
    session: Session = Depends(get_db_session),
    x_user_id: str | None = Header(default=None),
) -> dict[str, object]:
    require_user_id(x_user_id)
    category = create_category_service(session, payload)
    return {"data": to_category_response(category)}


@router.get("/products")
async def list_products(
    session: Session = Depends(get_db_session),
    mine: bool = Query(default=False),
    x_user_id: str | None = Header(default=None),
) -> dict[str, object]:
    owner_id = require_user_id(x_user_id) if mine else None
    return {"data": [to_product_response(item) for item in list_products_service(session, owner_id=owner_id)]}


@router.post("/products", status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    session: Session = Depends(get_db_session),
    x_user_id: str | None = Header(default=None),
) -> dict[str, object]:
    owner_id = require_user_id(x_user_id)
    await verify_store_ownership(payload.store_id, owner_id)
    product = create_product_service(session, owner_id, payload)
    return {"data": to_product_response(product)}


@router.get("/products/{slug}")
async def get_product(
    slug: str,
    session: Session = Depends(get_db_session),
    x_user_id: str | None = Header(default=None),
) -> dict[str, object]:
    owner_id = x_user_id if x_user_id else None
    return {"data": to_product_response(get_product_by_slug_service(session, slug, owner_id=owner_id))}


@router.patch("/products/{product_id}")
async def update_product(
    product_id: str,
    payload: ProductUpdate,
    session: Session = Depends(get_db_session),
    x_user_id: str | None = Header(default=None),
) -> dict[str, object]:
    product = update_product_service(session, product_id, require_user_id(x_user_id), payload)
    return {"data": to_product_response(product)}


@router.post("/checkout", status_code=status.HTTP_201_CREATED)
async def checkout_product(
    payload: CheckoutCreate,
    session: Session = Depends(get_db_session),
) -> dict[str, object]:
    order = checkout_product_service(session, payload)
    return {"data": to_order_response(order)}


@router.get("/orders")
async def list_orders(
    session: Session = Depends(get_db_session),
    mine: bool = Query(default=False),
    x_user_id: str | None = Header(default=None),
) -> dict[str, object]:
    if not mine:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only vendor order listing is supported")
    owner_id = require_user_id(x_user_id)
    return {"data": [to_order_response(order) for order in list_orders_service(session, owner_id)]}
