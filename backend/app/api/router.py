"""Top-level API router: aggregates all route modules."""

from fastapi import APIRouter

from app.api.routes import health, identity, posts, reports

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(identity.router, tags=["identity"])
api_router.include_router(posts.router, tags=["posts"])
api_router.include_router(reports.router, tags=["reports"])
