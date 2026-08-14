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
from sqlalchemy.orm import selectinload

from app.core.geocoder import GeocodedAddress
from app.models.location import Location
from app.models.post import Post, PostStatus
from app.services.reach import MAX_RADIUS_M, RADIUS_STEPS, reach_for
from app.services.trust import is_new_neighbour, neighbour_cap

# Expanding-radius ladder (metres) per ADR 0007.
# (``RADIUS_STEPS``/``MAX_RADIUS_M`` live in ``reach`` to avoid a cycle.)


@dataclass
class FeedPost:
    id: str
    body: str
    voice: str
    display_address: str
    geohash: str
    distance_m: float
    created_at: object
    pseudonym: str | None = None
    new_neighbour: bool = True


async def _posts_within(
    session: AsyncSession,
    viewer: GeocodedAddress,
    radius_m: int,
    search_radius_m: int,
) -> list[tuple[Post, Location, float]]:
    """Return active posts within ``radius_m``, before scope filtering.

    Uses ``ST_DWithin`` on the GiST-indexed geography column. The distance is
    computed with ``ST_Distance`` so visibility can be evaluated precisely.
    Posts hidden or auto-hidden by reports (ADR 0009) are excluded.
    """
    viewer_geog = func.ST_GeogFromText(f"SRID=4326;POINT({viewer.longitude} {viewer.latitude})")
    # ST_DWithin(geography, geography, metres) — the column is geography.
    within = geo_func.ST_DWithin(Location.point, viewer_geog, radius_m)
    distance = geo_func.ST_Distance(Location.point, viewer_geog)

    stmt = (
        select(Post, Location, distance.label("distance_m"))
        .join(Location, Post.location_id == Location.id)
        .options(selectinload(Post.device))
        .where(within, Post.status == PostStatus.active)
        .order_by(distance.asc())
    )
    result = await session.execute(stmt)
    rows = [(post, location, float(distance_m)) for post, location, distance_m in result.all()]
    return rows


async def _is_visible(
    session: AsyncSession,
    post: Post,
    location: Location,
    distance_m: float,
    viewer: GeocodedAddress,
    search_radius_m: int,
) -> bool:
    """Plan visibility: distance <= post.reach_m AND distance <= search_radius.

    ``reach_m`` is converted from the author's voice + trust cap at serve time
    (neighbour-count -> distance). ``building`` yields reach 0 (same normalized
    address key).
    """
    if distance_m > search_radius_m:
        return False

    if post.voice == "building":
        return location.normalized_key == viewer.normalized_key

    author = post.device
    k = neighbour_cap(author) if author is not None else 1
    exclude = {post.device_id} if post.device_id is not None else None
    reach_m = await reach_for(session, location, k=k, exclude_device_ids=exclude)
    return distance_m <= reach_m


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
        visible = []
        for post, location, distance_m in candidates:
            if await _is_visible(
                session, post, location, distance_m, viewer, search_radius_m
            ):
                visible.append((post, location, distance_m))
        if len(visible) >= target_count or radius_m == MAX_RADIUS_M:
            feed_posts = []
            for post, location, distance_m in visible:
                author = post.device
                feed_posts.append(
                    FeedPost(
                        id=str(post.id),
                        body=post.body,
                        voice=post.voice,
                        display_address=location.display_address,
                        geohash=location.geohash,
                        distance_m=distance_m,
                        created_at=post.created_at,
                        pseudonym=author.pseudonym if author else None,
                        new_neighbour=is_new_neighbour(author) if author else True,
                    )
                )
            return feed_posts, effective_radius

    return [], MAX_RADIUS_M
