from netiks_shared.config import CommonSettings


class Settings(CommonSettings):
    app_name: str = "catalog-service"
    app_port: int = 8003
    catalog_db_schema: str = "catalog"
    vendor_service_url: str = "http://vendor-service:8002"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )
