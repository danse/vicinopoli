"""Top-level API router: aggregates all route modules."""

from fastapi import APIRouter

from app.api.routes import health, posts

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(posts.router, tags=["posts"])
