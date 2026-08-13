"""Feed service: expanding-radius feed honouring scope/visibility semantics.

Implements ADR 0006 (visibility = distance <= scope AND distance <=
search_radius; ``building`` matches on the normalized address key) and ADR 0007
(expand radius until ~target_count posts, hard ceiling ~50km).
"""

from __future__ import annotations

from dataclasses import dataclass

from geoalchemy2 import functions as geo_func
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.geocoder import GeocodedAddress
from app.models.location import Location
from app.models.post import Post, PostScope

# Expanding-radius ladder (metres) per ADR 0007.
RADIUS_STEPS = (500, 1_000, 5_000, 20_000, 50_000)

# Hard ceiling for the expanding-radius search.
MAX_RADIUS_M = 50_000

# Scope -> max reach in metres (``building`` is handled separately).
SCOPE_RADIUS_M: dict[PostScope, int | None] = {
    PostScope.building: None,
    PostScope.r500m: 500,
    PostScope.r1km: 1_000,
    PostScope.r5km: 5_000,
}


@dataclass
class FeedPost:
    id: str
    body: str
    scope: PostScope
    display_address: str
    geohash: str
    distance_m: float
    created_at: object


async def _posts_within(
    session: AsyncSession,
    viewer: GeocodedAddress,
    radius_m: int,
    search_radius_m: int,
) -> list[tuple[Post, Location, float]]:
    """Return posts within ``radius_m``, before scope filtering.

    Uses ``ST_DWithin`` on the GiST-indexed geography column. The distance is
    computed with ``ST_Distance`` so visibility can be evaluated precisely.
    """
    viewer_geog = func.ST_GeogFromText(f"SRID=4326;POINT({viewer.longitude} {viewer.latitude})")
    # ST_DWithin(geography, geography, metres) — the column is geography.
    within = geo_func.ST_DWithin(Location.point, viewer_geog, radius_m)
    distance = geo_func.ST_Distance(Location.point, viewer_geog)

    stmt = (
        select(Post, Location, distance.label("distance_m"))
        .join(Location, Post.location_id == Location.id)
        .where(within)
        .order_by(distance.asc())
    )
    result = await session.execute(stmt)
    rows = [(post, location, float(distance_m)) for post, location, distance_m in result.all()]
    return rows


def _is_visible(
    post: Post,
    location: Location,
    distance_m: float,
    viewer: GeocodedAddress,
    search_radius_m: int,
) -> bool:
    """ADR 0006: distance <= scope AND distance <= search_radius.

    ``building`` scope additionally requires the viewer to resolve to the same
    normalized address key.
    """
    if distance_m > search_radius_m:
        return False

    scope_radius = SCOPE_RADIUS_M[post.scope]
    if post.scope == PostScope.building:
        return location.normalized_key == viewer.normalized_key
    assert scope_radius is not None
    return distance_m <= scope_radius


async def expanding_radius_feed(
    session: AsyncSession,
    viewer: GeocodedAddress,
    target_count: int = 10,
    search_radius_m: int = MAX_RADIUS_M,
) -> tuple[list[FeedPost], int]:
    """Build the feed, widening the radius until ``target_count`` is reached.

    Returns ``(posts, effective_radius_m)``.
    """
    for radius_m in RADIUS_STEPS:
        effective_radius = min(radius_m, search_radius_m)
        candidates = await _posts_within(session, viewer, radius_m, search_radius_m)
        visible = [
            (post, location, distance_m)
            for post, location, distance_m in candidates
            if _is_visible(post, location, distance_m, viewer, search_radius_m)
        ]
        if len(visible) >= target_count or radius_m == MAX_RADIUS_M:
            feed_posts = [
                FeedPost(
                    id=str(post.id),
                    body=post.body,
                    scope=post.scope,
                    display_address=location.display_address,
                    geohash=location.geohash,
                    distance_m=distance_m,
                    created_at=post.created_at,
                )
                for post, location, distance_m in visible
            ]
            return feed_posts, effective_radius

    return [], MAX_RADIUS_M
