from fastapi import FastAPI

from netiks_shared.health import health_router

app = FastAPI(title="Netiks Store Admin Service", version="0.1.0")

app.include_router(health_router)


@app.get("/admin/summary")
async def summary() -> dict[str, object]:
    return {"data": {"users": 0, "stores": 0, "products": 0}, "message": "Admin service scaffold ready"}

