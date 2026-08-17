"""Daily posting quota service (ADR 0022).

Trust gates *how much an unknown device can write*, not how far its posts
travel. The quota counts the device's posts in the current UTC day and is
enforced at publish time; the same numbers are surfaced to the user via
``/api/me`` and the create-post response.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device import Device
from app.models.post import Post
from app.services.trust import daily_post_quota


def _utc_day_start(reference: datetime) -> datetime:
    """Start of the UTC calendar day containing ``reference``."""
    return reference.replace(hour=0, minute=0, second=0, microsecond=0)


async def posts_used_today(
    session: AsyncSession, device_id: uuid.UUID, now: datetime | None = None
) -> int:
    """Number of posts the device has published since the UTC day started."""
    reference = now or datetime.now(UTC)
    count = await session.scalar(
        select(func.count(Post.id)).where(
            Post.device_id == device_id,
            Post.created_at >= _utc_day_start(reference),
        )
    )
    return int(count or 0)


async def posts_left_today(
    session: AsyncSession, device: Device, now: datetime | None = None
) -> int:
    """How many more posts the device may publish today (0 means blocked)."""
    quota = daily_post_quota(device, now)
    used = await posts_used_today(session, device.id, now)
    return max(0, quota - used)