"""Application entrypoint.

The FastAPI app exposes a health/readiness surface under ``/healthz`` and
``/readyz``, and the versioned API under ``/api``. The OpenAPI schema is
generated from the Pydantic models in ``app.schemas`` and consumed by
``make gen`` to produce the frontend TypeScript types.
"""

import logging
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse, PlainTextResponse, Response
from prometheus_client import generate_latest
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.api.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging, configure_sentry
from app.services.metrics import observe_request
from app.services.readiness import readiness_checks
from app.services.storage import get_client, get_probe_client

logger = logging.getLogger(__name__)

configure_logging()
configure_sentry()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Ensure the object-store bucket exists before serving is marked ready."""
    try:
        get_client()
    except Exception:
        logger.exception("Failed to initialise the object-store bucket at startup")
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)


@app.middleware("http")
async def record_request_metrics(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    start = time.monotonic()
    response = await call_next(request)
    duration = time.monotonic() - start
    route = request.scope.get("route")
    route_path: str = route.path if route is not None else request.url.path
    observe_request(
        method=request.method,
        route=route_path,
        status=response.status_code,
        duration_seconds=duration,
    )
    return response


app.include_router(api_router, prefix="/api")


@app.get("/healthz", tags=["health"])
async def healthz() -> dict[str, str]:
    """Liveness probe: the process is up."""
    return {"status": "ok"}


@app.get("/readyz", tags=["health"])
async def readyz(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> JSONResponse:
    """Readiness probe: downstream dependencies must be reachable.

    Returns 200 only when the database and the object store both answer;
    otherwise 503 with the per-dependency results so operators can see what
    failed.
    """
    checks = await readiness_checks(session, get_probe_client())
    ready = all(checks.values())
    return JSONResponse(
        status_code=200 if ready else 503,
        content={"status": "ok" if ready else "unavailable", "checks": checks},
    )


@app.get("/metrics", include_in_schema=False)
async def metrics() -> PlainTextResponse:
    """Prometheus text exposition (ADR 0012). No PII is included."""
    content = generate_latest().decode()
    return PlainTextResponse(content=content, media_type="text/plain; version=0.0.4; charset=utf-8")
