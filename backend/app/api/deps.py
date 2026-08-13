"""Dependency injection helpers."""

from collections.abc import AsyncIterator
from typing import Annotated
from uuid import UUID

from fastapi import Cookie, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.geocoder import Geocoder, build_geocoder
from app.core.ratelimit import RateLimiter, build_rate_limiter
from app.db import async_session_factory
from app.models.device import Device

_geocoder: Geocoder | None = None
_post_rate_limiter: RateLimiter | None = None


def get_geocoder() -> Geocoder:
    global _geocoder
    if _geocoder is None:
        _geocoder = build_geocoder(
            settings.geocoder_mode,
            settings.nominatim_base_url,
            settings.geocoder_cache_ttl,
        )
    return _geocoder


async def get_session() -> AsyncIterator[AsyncSession]:
    async with async_session_factory() as session:
        yield session


async def get_device(
    response: Response,
    session: Annotated[AsyncSession, Depends(get_session)],
    device_id: str | None = Cookie(default=None, alias=settings.device_cookie_name),
) -> Device:
    """Return the caller's Device, creating it and setting the cookie lazily.

    The anonymous device token is an httpOnly cookie (ADR 0005). If the cookie
    is absent or stale we mint a fresh device and echo its id back in the
    cookie so the browser remembers it for subsequent requests.
    """
    if device_id is not None:
        try:
            device = await session.get(Device, UUID(device_id))
        except (ValueError, AttributeError):
            device = None
        if device is not None:
            return device

    device = Device()
    session.add(device)
    await session.flush()

    response.set_cookie(
        key=settings.device_cookie_name,
        value=str(device.id),
        httponly=True,
        samesite="lax",
        secure=settings.device_cookie_secure,
        max_age=60 * 60 * 24 * 365,
    )
    return device


def get_post_rate_limiter() -> RateLimiter | None:
    global _post_rate_limiter
    if _post_rate_limiter is None and settings.post_rate_limit_per_minute is not None:
        _post_rate_limiter = build_rate_limiter(
            settings.post_rate_limit_per_minute,
            window_seconds=60,
            enabled=True,
        )
    return _post_rate_limiter
