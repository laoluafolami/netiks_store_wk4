from fastapi import FastAPI

from app import models  # noqa: F401
from app.routes import router as store_router
from netiks_shared.health import health_router

app = FastAPI(title="Netiks Store Vendor Service", version="0.1.0")

app.include_router(health_router)
app.include_router(store_router)
