from pydantic import Field

from netiks_shared.config import CommonSettings


class Settings(CommonSettings):
    app_name: str = "gateway"
    app_port: int = 8000
    identity_service_url: str = Field(default="http://identity-service:8001", alias="IDENTITY_SERVICE_URL")
    vendor_service_url: str = Field(default="http://vendor-service:8002", alias="VENDOR_SERVICE_URL")
    catalog_service_url: str = Field(default="http://catalog-service:8003", alias="CATALOG_SERVICE_URL")
    media_service_url: str = Field(default="http://media-service:8004", alias="MEDIA_SERVICE_URL")
