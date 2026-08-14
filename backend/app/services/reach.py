"""Neighbour-count reach conversion (plan: Reach model).

Converts a post's voice intent — via the author's trust cap ``K`` — into a
distance ``reach_m`` at feed-serve time. ``reach_m`` is the smallest radius,
walking the ladder ``500m -> 1km -> 5km -> 20km -> 50km``, that contains ``K``
distinct *other* active posters relative to the post's location. If fewer than
``K`` others exist anywhere, ``reach_m`` is the 50km ceiling (sparse-area
honesty so a lone new user can still reach a distant community).

This is the "neighbours -> distance" conversion layer: visibility keeps the
distance-based semantics (plan: Visibility) while the author's voice stays
fuzzy and honest.
"""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.location import Location
from app.models.post import Post, PostStatus

# Expanding-radius ladder (metres) per ADR 0007.
RADIUS_STEPS = (500, 1_000, 5_000, 20_000, 50_000)

# Hard ceiling for the expanding-radius search.
MAX_RADIUS_M = 50_000


async def reach_for(
    session: AsyncSession,
    location: Location,
    k: int,
    exclude_device_ids: set[uuid.UUID] | None = None,
) -> int:
    """Smallest radius containing ``k`` distinct *other* active posters.

    The author's own device is excluded so a lone author does not satisfy their
    own neighbour count. When fewer than ``k`` others exist anywhere, returns
    the 50km ceiling.
    """
    excluded = exclude_device_ids or set()
    centre = func.ST_GeogFromText(
        f"SRID=4326;POINT({location.longitude} {location.latitude})"
    )
    base = (
        select(func.count(func.distinct(Post.device_id)))
        .join(Location, Post.location_id == Location.id)
        .where(
            Post.status == PostStatus.active,
            Post.device_id.isnot(None),
        )
    )
    if excluded:
        base = base.where(Post.device_id.notin_(excluded))

    for radius_m in RADIUS_STEPS:
        within = func.ST_DWithin(Location.point, centre, radius_m)
        stmt = base.where(within)
        distinct_posters = await session.scalar(stmt)
        if distinct_posters is not None and distinct_posters >= k:
            return radius_m

    return MAX_RADIUS_M
