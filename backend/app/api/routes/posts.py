"""Post creation and feed endpoints.

- ``POST /api/posts`` — geocode the address, resolve the canonical location,
  and store a text post.
- ``GET  /api/feed`` — expanding-radius feed honouring scope/visibility.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_geocoder, get_session
from app.core.geocoder import Geocoder
from app.models.location import Location
from app.models.post import Post
from app.schemas.post import (
    FeedItem,
    FeedResponse,
    LocationInfo,
    PostCreate,
    PostResponse,
)
from app.services.feed import MAX_RADIUS_M, expanding_radius_feed

router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_session)]
GeocoderDep = Annotated[Geocoder, Depends(get_geocoder)]


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


@router.post("/posts", response_model=PostResponse, status_code=201)
async def create_post(
    payload: PostCreate,
    session: SessionDep,
    geocoder: GeocoderDep,
) -> PostResponse:
    location, _ = await _resolve_location(session, geocoder, payload.address)

    post = Post(location_id=location.id, body=payload.body, scope=payload.scope)
    session.add(post)
    await session.commit()
    await session.refresh(post)

    return PostResponse(
        id=post.id,
        body=post.body,
        scope=post.scope,
        location=LocationInfo(
            id=location.id,
            display_address=location.display_address,
            geohash=location.geohash,
        ),
        distance_m=0.0,
        created_at=post.created_at,
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

    return FeedResponse(
        posts=[
            FeedItem(
                id=post.id,
                body=post.body,
                scope=post.scope,
                display_address=post.display_address,
                geohash=post.geohash,
                distance_m=post.distance_m,
                created_at=post.created_at,
            )
            for post in feed_posts
        ],
        effective_radius_m=effective_radius,
        target_count=target_count,
    )
