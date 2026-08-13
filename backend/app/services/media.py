"""Helpers to map Media rows to feed/posts (ADR 0013)."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.media import Media
from app.schemas.media import MediaInfo
from app.services.storage import presign_get


def media_info(media: list[Media]) -> list[MediaInfo]:
    return [
        MediaInfo(
            id=m.id,
            kind=m.kind,
            url=presign_get(m.object_key) if m.object_key else "",
            duration_s=m.duration_s,
        )
        for m in media
    ]


async def media_by_post(session: AsyncSession, post_ids: list[str]) -> dict[str, list[Media]]:
    result: dict[str, list[Media]] = {}
    if not post_ids:
        return result
    rows = await session.scalars(select(Media).where(Media.post_id.in_(post_ids)))
    for media in rows:
        result.setdefault(str(media.post_id), []).append(media)
    return result