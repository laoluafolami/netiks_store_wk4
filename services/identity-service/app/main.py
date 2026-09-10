from fastapi import FastAPI

from app import models  # noqa: F401
from app.routes import router as auth_router
from netiks_shared.health import health_router

app = FastAPI(title="Netiks Store Identity Service", version="0.1.0")

app.include_router(health_router)
app.include_router(auth_router)
