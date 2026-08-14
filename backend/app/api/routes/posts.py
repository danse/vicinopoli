"""Post creation and feed endpoints.

- ``POST /api/posts`` — geocode the address, resolve the canonical location,
  and store a text post attributed to the calling device (ADR 0005 caps the
  scope of untrusted devices).
- ``GET  /api/feed`` — expanding-radius feed honouring scope/visibility; posts
  that are reported-hidden are excluded (ADR 0009).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_device, get_geocoder, get_post_rate_limiter, get_session
from app.core.geocoder import Geocoder
from app.core.ratelimit import RateLimiter
from app.models.device import Device
from app.models.location import Location
from app.models.media import Media
from app.models.post import Post
from app.schemas.post import (
    FeedItem,
    FeedResponse,
    LocationInfo,
    PostCreate,
    PostResponse,
    PostScope,
    PostVoice,
)
from app.services.feed import expanding_radius_feed
from app.services.heatmap import bump_activity_cell
from app.services.media import media_by_post, media_info
from app.services.reach import MAX_RADIUS_M
from app.services.trust import is_new_neighbour

router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_session)]
GeocoderDep = Annotated[Geocoder, Depends(get_geocoder)]
DeviceDep = Annotated[Device, Depends(get_device)]
RateLimiterDep = Annotated[RateLimiter | None, Depends(get_post_rate_limiter)]


async def _resolve_location(
    session: AsyncSession, geocoder: Geocoder, address: str
) -> tuple[Location, object]:
    """Geocode an address and return the canonical Location row.

    Returns the geocoded display address too so the caller can build responses.
    """
    geocoded = await geocoder.geocode(address)
    if geocoded is None:
        raise HTTPException(status_code=404, detail="address not found")

    location = await session.scalar(
        select(Location).where(Location.normalized_key == geocoded.normalized_key)
    )
    if location is None:
        location = Location(
            normalized_key=geocoded.normalized_key,
            display_address=geocoded.display_address,
            latitude=geocoded.latitude,
            longitude=geocoded.longitude,
            geohash=geocoded.geohash,
            point=func.ST_GeogFromText(
                f"SRID=4326;POINT({geocoded.longitude} {geocoded.latitude})"
            ),
        )
        session.add(location)
        await session.flush()
    return location, geocoded


def _scope_to_voice(scope: PostScope) -> PostVoice:
    """Map a legacy km scope onto the voice intent model."""
    if scope == PostScope.building:
        return PostVoice.building
    if scope == PostScope.r5km:
        return PostVoice.area
    return PostVoice.some


@router.post("/posts", response_model=PostResponse, status_code=201)
async def create_post(
    payload: PostCreate,
    session: SessionDep,
    geocoder: GeocoderDep,
    device: DeviceDep,
    rate_limiter: RateLimiterDep,
) -> PostResponse:
    if rate_limiter is not None and not rate_limiter.allow(str(device.id)):
        raise HTTPException(status_code=429, detail="rate limit exceeded")

    location, _ = await _resolve_location(session, geocoder, payload.address)

    # The author's voice is ``voice``; the trust ladder caps it as a
    # neighbour-count, converted to distance only at feed-serve time.
    if payload.scope is not None and payload.voice == PostVoice.city:
        # Backwards-compat: a legacy km scope maps to the closest intent.
        payload.voice = _scope_to_voice(payload.scope)
    post = Post(
        location_id=location.id,
        body=payload.body,
        voice=payload.voice,
        device_id=device.id,
    )
    session.add(post)
    await session.flush()
    await bump_activity_cell(session, location)

    attached: list[Media] = []
    if payload.media_ids:
        media_rows = await session.scalars(
            select(Media).where(Media.id.in_(payload.media_ids))
        )
        for media in media_rows:
            if media.post_id is None:
                media.post_id = post.id
                attached.append(media)
    await session.commit()
    await session.refresh(post)
    await session.refresh(post.location)

    return PostResponse(
        id=post.id,
        body=post.body,
        scope=post.scope,
        voice=post.voice,
        location=LocationInfo(
            id=location.id,
            display_address=location.display_address,
            geohash=location.geohash,
        ),
        distance_m=0.0,
        created_at=post.created_at,
        pseudonym=device.pseudonym,
        new_neighbour=is_new_neighbour(device),
        media=media_info(attached),
    )


@router.get("/feed", response_model=FeedResponse)
async def get_feed(
    session: SessionDep,
    geocoder: GeocoderDep,
    address: str = Query(min_length=1, max_length=512),
    target_count: int = Query(default=10, ge=1, le=50),
    search_radius_m: int = Query(default=MAX_RADIUS_M, ge=1, le=MAX_RADIUS_M),
) -> FeedResponse:
    geocoded = await geocoder.geocode(address)
    if geocoded is None:
        raise HTTPException(status_code=404, detail="address not found")

    feed_posts, effective_radius = await expanding_radius_feed(
        session, geocoded, target_count=target_count, search_radius_m=search_radius_m
    )

    post_ids = [post.id for post in feed_posts]
    media_by_id = await media_by_post(session, post_ids)

    return FeedResponse(
        posts=[
            FeedItem(
                id=post.id,
                body=post.body,
                scope=None,
                voice=post.voice,
                display_address=post.display_address,
                geohash=post.geohash,
                distance_m=post.distance_m,
                created_at=post.created_at,
                pseudonym=post.pseudonym,
                new_neighbour=post.new_neighbour,
                media=media_info(media_by_id.get(post.id, [])),
            )
            for post in feed_posts
        ],
        effective_radius_m=effective_radius,
        target_count=target_count,
    )
