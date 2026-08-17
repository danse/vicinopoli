"""Feed service: expanding-radius feed honouring scope/visibility semantics.

Implements ADR 0006 (visibility = distance <= scope AND distance <=
search_radius; ``building`` matches on the normalized address key) and ADR 0007
(expand radius until ~target_count posts, hard ceiling ~50km).

Pagination is keyset-based: each page carries a ``next_cursor`` encoding the
last post's ``(created_at, id)``, so the next request resumes strictly after it.
"""

from __future__ import annotations

import base64
import uuid
from dataclasses import dataclass
from datetime import datetime

from geoalchemy2 import functions as geo_func
from sqlalchemy import and_, func, or_, select
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
    created_at: datetime
    pseudonym: str | None = None
    new_neighbour: bool = True


def encode_cursor(created_at: datetime, post_id: uuid.UUID) -> str:
    """Encode ``(created_at, id)`` into an opaque keyset cursor."""
    raw = f"{created_at.isoformat()}:{post_id}".encode()
    return base64.urlsafe_b64encode(raw).decode()


def decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    """Decode an opaque keyset cursor back into ``(created_at, id)``."""
    raw = base64.urlsafe_b64decode(cursor.encode()).decode()
    ts, _, post_id = raw.rpartition(":")
    return datetime.fromisoformat(ts), uuid.UUID(post_id)


async def _posts_within(
    session: AsyncSession,
    viewer: GeocodedAddress,
    radius_m: int,
    search_radius_m: int,
    cursor: tuple[datetime, uuid.UUID] | None = None,
) -> list[tuple[Post, Location, float]]:
    """Return active posts within ``radius_m``, before scope filtering.

    Uses ``ST_DWithin`` on the GiST-indexed geography column. The distance is
    computed with ``ST_Distance`` so visibility can be evaluated precisely.
    Posts hidden or auto-hidden by reports (ADR 0009) are excluded. When a
    ``cursor`` is given, only posts strictly older than it are returned.
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
        .order_by(Post.created_at.desc(), Post.id.desc())
    )
    if cursor is not None:
        cursor_ts, cursor_id = cursor
        stmt = stmt.where(
            or_(
                Post.created_at < cursor_ts,
                and_(Post.created_at == cursor_ts, Post.id < cursor_id),
            )
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
    cursor: tuple[datetime, uuid.UUID] | None = None,
) -> tuple[list[FeedPost], int, str | None]:
    """Build the feed, widening the radius until ``target_count`` is reached.

    Returns ``(posts, effective_radius_m, next_cursor)``. ``next_cursor`` is
    ``None`` when there are no more posts after this page; otherwise it encodes
    the last post's ``(created_at, id)`` for the next page.
    """
    for radius_m in RADIUS_STEPS:
        effective_radius = min(radius_m, search_radius_m)
        candidates = await _posts_within(session, viewer, radius_m, search_radius_m, cursor=cursor)
        visible: list[tuple[Post, Location, float]] = []
        for post, location, distance_m in candidates:
            # Candidates are newest-first: once the page is full we can stop,
            # the remaining posts belong on a later page. At the ceiling the
            # full scan still runs so ``has_more`` below stays accurate.
            if radius_m < MAX_RADIUS_M and len(visible) >= target_count:
                break
            if await _is_visible(
                session, post, location, distance_m, viewer, search_radius_m
            ):
                visible.append((post, location, distance_m))
        if len(visible) >= target_count or radius_m == MAX_RADIUS_M:
            feed_posts = []
            for post, location, distance_m in visible[:target_count]:
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
            next_cursor: str | None = None
            has_more = radius_m < MAX_RADIUS_M or len(visible) > target_count
            if has_more and feed_posts:
                last = feed_posts[-1]
                next_cursor = encode_cursor(last.created_at, uuid.UUID(last.id))
            return feed_posts, effective_radius, next_cursor

    return [], MAX_RADIUS_M, None
