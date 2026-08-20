"""Dependency injection helpers."""

import hmac
from collections.abc import AsyncIterator
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import Cookie, Depends, Header, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.geocoder import Geocoder, build_geocoder
from app.core.ratelimit import RateLimiter, build_rate_limiter
from app.db import async_session_factory
from app.models.device import Device
from app.services.experiments import segment_for
from app.services.linkpreview import LinkPreviewFetcher

_geocoder: Geocoder | None = None
_post_rate_limiter: RateLimiter | None = None
_preview_fetcher: LinkPreviewFetcher | None = None
_preview_rate_limiter: RateLimiter | None = None


def get_geocoder() -> Geocoder:
    global _geocoder
    if _geocoder is None:
        base_url = (
            settings.photon_base_url
            if settings.geocoder_mode == "photon"
            else settings.nominatim_base_url
        )
        _geocoder = build_geocoder(
            settings.geocoder_mode,
            base_url,
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

    device_id_value = uuid4()
    device = Device(
        id=device_id_value,
        experiment_segment=segment_for(device_id_value),
    )
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


def get_preview_fetcher() -> LinkPreviewFetcher:
    global _preview_fetcher
    if _preview_fetcher is None:
        _preview_fetcher = LinkPreviewFetcher(
            timeout=settings.preview_timeout,
            ttl_seconds=settings.preview_cache_ttl,
        )
    return _preview_fetcher


def get_preview_rate_limiter() -> RateLimiter | None:
    global _preview_rate_limiter
    if _preview_rate_limiter is None and settings.preview_rate_limit_per_minute is not None:
        _preview_rate_limiter = build_rate_limiter(
            settings.preview_rate_limit_per_minute,
            window_seconds=60,
            enabled=True,
        )
    return _preview_rate_limiter


def require_admin(
    x_admin_token: Annotated[str | None, Header()] = None,
) -> None:
    """Gate the internal admin API behind the shared ``ADMIN_TOKEN`` (ADR 0021).

    The token is compared in constant time. When ``ADMIN_TOKEN`` is not set the
    admin surface is disabled entirely (401), so a misconfigured deployment
    fails closed rather than exposing the firehose.
    """
    expected = settings.admin_token
    if expected is None or x_admin_token is None:
        raise HTTPException(status_code=401, detail="unauthorized")
    if not hmac.compare_digest(x_admin_token, expected):
        raise HTTPException(status_code=401, detail="unauthorized")
