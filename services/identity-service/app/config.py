from netiks_shared.config import CommonSettings


class Settings(CommonSettings):
    app_name: str = "identity-service"
    app_port: int = 8001
    identity_db_schema: str = "identity"
    refresh_token_expire_days: int = 14

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )
