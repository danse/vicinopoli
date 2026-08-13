"""Dependency injection helpers."""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.geocoder import Geocoder, build_geocoder
from app.db import async_session_factory

_geocoder: Geocoder | None = None


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
