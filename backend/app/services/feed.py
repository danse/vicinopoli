"""Feed service: adaptive feed honouring reach semantics.

Implements ADR 0024: visibility = distance <= reach(voice), where reach comes
from the stored ``voice`` via ``VOICE_TO_REACH_M`` (a fixed lookup, not
density- or trust-derived; see ``app.services.reach``). The feed's *scope* is
how far it searched to fill the page: it widens the search radius step by step
(``SCOPE_STEPS``, the sorted voice reaches) until ``target_count`` visible
posts are gathered or the 50km ceiling is reached (ADR 0007);
``effective_radius_m`` is the step where the feed stopped, so the "Entro <x>"
label is honest.

``street`` is a 5m reach (there are no street numbers yet), not a normalized
address key match.

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
from app.services.reach import VOICE_TO_REACH_M, ScopeStep, scope_step_to_m
from app.services.trust import is_new_neighbour

# Expanding-radius ladder (metres) for the adaptive feed: the sorted voice
# reaches, so the feed fills step by step and the "Entro <x>" label is honest.
SCOPE_STEPS: tuple[int, ...] = tuple(
    sorted(scope_step_to_m(step) for step in ScopeStep)
)

# Hard ceiling for the expanding-radius search.
MAX_SCOPE_M: int = SCOPE_STEPS[-1]

# The feed widens until the posts within reach include at least this many
# distinct posters (devices); a page is not considered full just because one
# author posted many times. ``target_count`` is the page-size cap.
MIN_POSTERS: int = 10


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
    cursor: tuple[datetime, uuid.UUID] | None = None,
) -> list[tuple[Post, Location, float]]:
    """Return active posts within ``radius_m``, before reach filtering.

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


def _is_visible(post: Post, distance_m: float) -> bool:
    """Plan visibility: distance <= reach(voice).

    ``reach`` is the fixed voice->distance lookup (ADR 0024); it is trust-free
    and never density-dependent. ``street`` is a 5m reach, not a normalized
    address key match.
    """
    return distance_m <= VOICE_TO_REACH_M[post.voice]


def _distinct_posters(rows: list[tuple[Post, Location, float]]) -> int:
    """Distinct active posters (devices) among visibility-filtered posts.

    The adaptive feed widens until it covers ``MIN_POSTERS`` distinct authors,
    so a single prolific author's posts never fill a page by themselves.
    """
    return len({row[0].device_id for row in rows})


async def expanding_radius_feed(
    session: AsyncSession,
    viewer: GeocodedAddress,
    target_count: int = 10,
    cursor: tuple[datetime, uuid.UUID] | None = None,
    radius_m: ScopeStep | None = None,
) -> tuple[list[FeedPost], int, str | None]:
    """Build the feed, widening the radius until ``MIN_POSTERS`` distinct
    posters are covered (or the 50km ceiling).

    ``radius_m`` seeds the ladder (the client echoes the previous page's scope
    on scroll), so later pages never re-widen below the established scope and
    "Entro <x>" stays stable while paging. ``target_count`` caps the returned
    page size.

    Returns ``(posts, effective_radius_m, next_cursor)``. ``next_cursor`` is
    ``None`` when there are no more posts after this page; otherwise it encodes
    the last post's ``(created_at, id)`` for the next page.
    """
    steps = SCOPE_STEPS
    if radius_m is not None:
        start = scope_step_to_m(radius_m)
        steps = tuple(step for step in SCOPE_STEPS if step >= start) or (MAX_SCOPE_M,)

    for radius in steps:
        candidates = await _posts_within(session, viewer, radius, cursor=cursor)
        # The distinct-poster count must cover *all* visible posts in the
        # radius (not just the newest target_count), or a dense radius could
        # be misread as sparse when one author dominates the newest posts.
        visible = [
            (post, location, float(distance_m))
            for post, location, distance_m in candidates
            if _is_visible(post, distance_m)
        ]
        if _distinct_posters(visible) >= MIN_POSTERS or radius == MAX_SCOPE_M:
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
            has_more = radius < MAX_SCOPE_M or len(visible) > target_count
            if has_more and feed_posts:
                last = feed_posts[-1]
                next_cursor = encode_cursor(last.created_at, uuid.UUID(last.id))
            return feed_posts, radius, next_cursor

    return [], MAX_SCOPE_M, None
