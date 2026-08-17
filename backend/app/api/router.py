"""Top-level API router: aggregates all route modules."""

from fastapi import APIRouter

from app.api.routes import (
    admin,
    experiments,
    health,
    heatmap,
    identity,
    media,
    posts,
    reports,
)

api_router = APIRouter()
api_router.include_router(admin.router, tags=["admin"])
api_router.include_router(health.router, tags=["health"])
api_router.include_router(identity.router, tags=["identity"])
api_router.include_router(media.router, tags=["media"])
api_router.include_router(posts.router, tags=["posts"])
api_router.include_router(reports.router, tags=["reports"])
api_router.include_router(experiments.router, tags=["experiments"])
api_router.include_router(heatmap.router, tags=["heatmap"])