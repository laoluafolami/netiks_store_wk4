from fastapi import FastAPI

from app.routes.auth import router as auth_router
from app.routes.catalog import router as catalog_router
from app.routes.stores import router as stores_router
from app.routes.system import router as system_router
from app.routes.uploads import router as uploads_router
from netiks_shared.health import health_router

app = FastAPI(title="Netiks Store Gateway", version="0.1.0")

app.include_router(health_router)
app.include_router(system_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(stores_router, prefix="/api/v1")
app.include_router(catalog_router, prefix="/api/v1")
app.include_router(uploads_router, prefix="/api/v1")
