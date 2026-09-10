from decimal import Decimal

from pydantic import BaseModel, Field


class CategoryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    slug: str = Field(min_length=2, max_length=140, pattern=r"^[a-z0-9-]+$")
    description: str | None = Field(default=None, max_length=500)


class ProductCreate(BaseModel):
    store_id: str = Field(min_length=36, max_length=36)
    category_id: str = Field(min_length=36, max_length=36)
    name: str = Field(min_length=2, max_length=160)
    slug: str = Field(min_length=2, max_length=180, pattern=r"^[a-z0-9-]+$")
    description: str = Field(min_length=10, max_length=3000)
    price: Decimal = Field(gt=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    stock_quantity: int = Field(ge=0)
    sold_quantity: int = Field(default=0, ge=0)
    sku: str = Field(min_length=2, max_length=80)
    status: str = Field(default="draft", max_length=40)
    featured_image_url: str | None = Field(default=None, max_length=255)


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    description: str | None = Field(default=None, min_length=10, max_length=3000)
    price: Decimal | None = Field(default=None, gt=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    stock_quantity: int | None = Field(default=None, ge=0)
    sku: str | None = Field(default=None, min_length=2, max_length=80)
    status: str | None = Field(default=None, max_length=40)
    featured_image_url: str | None = Field(default=None, max_length=255)
    category_id: str | None = Field(default=None, min_length=36, max_length=36)


class CategoryResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: str | None


class ProductResponse(BaseModel):
    id: str
    store_id: str
    owner_id: str
    category_id: str
    name: str
    slug: str
    description: str
    price: str
    currency: str
    stock_quantity: int
    sold_quantity: int
    sku: str
    status: str
    featured_image_url: str | None


class CheckoutCreate(BaseModel):
    product_id: str = Field(min_length=36, max_length=36)
    quantity: int = Field(ge=1, le=20)
    buyer_name: str = Field(min_length=2, max_length=120)
    buyer_email: str = Field(min_length=5, max_length=255)
    buyer_phone: str | None = Field(default=None, max_length=40)
    shipping_address: str = Field(min_length=10, max_length=500)
    payment_method: str = Field(default="demo-card", min_length=4, max_length=40)
    payment_last4: str = Field(min_length=4, max_length=4, pattern=r"^[0-9]{4}$")


class OrderResponse(BaseModel):
    id: str
    product_id: str
    store_id: str
    owner_id: str
    buyer_name: str
    buyer_email: str
    buyer_phone: str | None
    shipping_address: str
    quantity: int
    unit_price: str
    total_price: str
    payment_method: str
    payment_reference: str
    status: str
    created_at: str
