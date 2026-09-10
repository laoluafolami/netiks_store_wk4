from netiks_shared.config import CommonSettings


class Settings(CommonSettings):
    app_name: str = "vendor-service"
    app_port: int = 8002
    vendor_db_schema: str = "vendor"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )
