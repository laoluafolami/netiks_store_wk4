from netiks_shared.config import CommonSettings


class Settings(CommonSettings):
    app_name: str = "media-service"
    app_port: int = 8004
    max_upload_bytes: int = 5 * 1024 * 1024
