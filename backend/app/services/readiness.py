"""Readiness probes used by the guarded ``/readyz`` endpoint (ADR 0012).

Each probe returns a boolean and never raises: failures are reported as
``False`` so the endpoint can degrade to 503 without taking the process down.
Objects stay behind interfaces so unit tests can inject fakes.
"""

from typing import Protocol

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings


class ObjectStoreProbe(Protocol):
    def bucket_exists(self, name: str) -> bool: ...


async def check_database(session: AsyncSession) -> bool:
    """True when a trivial round-trip to the database succeeds."""
    try:
        await session.execute(text("SELECT 1"))
        await session.commit()
        return True
    except Exception:
        return False


async def check_object_store(store: ObjectStoreProbe) -> bool:
    """True when the configured bucket exists in the object store."""
    try:
        return store.bucket_exists(settings.minio_bucket)
    except Exception:
        return False


async def readiness_checks(session: AsyncSession, store: ObjectStoreProbe) -> dict[str, bool]:
    """Run every probe; individual failures never raise."""
    return {
        "database": await check_database(session),
        "object_store": await check_object_store(store),
    }
