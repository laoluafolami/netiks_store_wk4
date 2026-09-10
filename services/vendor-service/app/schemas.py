from pydantic import BaseModel, EmailStr, Field


class StoreCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    slug: str = Field(min_length=2, max_length=140, pattern=r"^[a-z0-9-]+$")
    description: str = Field(min_length=10, max_length=500)
    contact_email: EmailStr
    phone: str | None = Field(default=None, max_length=40)
    logo_url: str | None = Field(default=None, max_length=255)
    banner_url: str | None = Field(default=None, max_length=255)


class StoreUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, min_length=10, max_length=500)
    contact_email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    logo_url: str | None = Field(default=None, max_length=255)
    banner_url: str | None = Field(default=None, max_length=255)
    status: str | None = Field(default=None, max_length=40)


class StoreResponse(BaseModel):
    id: str
    owner_id: str
    name: str
    slug: str
    description: str
    contact_email: str
    phone: str | None
    logo_url: str | None
    banner_url: str | None
    status: str
