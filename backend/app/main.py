"""Application entrypoint.

The FastAPI app exposes a health/readiness surface under ``/healthz`` and
``/readyz``, and the versioned API under ``/api``. The OpenAPI schema is
generated from the Pydantic models in ``app.schemas`` and consumed by
``make gen`` to produce the frontend TypeScript types.
"""

from fastapi import FastAPI

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging, configure_sentry

configure_logging()
configure_sentry()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    openapi_url="/api/openapi.json",
)

app.include_router(api_router, prefix="/api")


@app.get("/healthz", tags=["health"])
async def healthz() -> dict[str, str]:
    """Liveness probe: the process is up."""
    return {"status": "ok"}


@app.get("/readyz", tags=["health"])
async def readyz() -> dict[str, str]:
    """Readiness probe: dependencies are reachable.

    Extended in later milestones to check the database and object storage.
    """
    return {"status": "ok"}
