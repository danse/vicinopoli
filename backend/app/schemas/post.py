"""Pydantic schemas for posts and the feed.

These are the single source of truth for the API contract; TypeScript types are
generated from them via ``make gen``.
"""

import uuid
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class PostScope(StrEnum):
    building = "building"
    r500m = "500m"
    r1km = "1km"
    r5km = "5km"


class PostStatus(StrEnum):
    active = "active"
    auto_hidden = "auto_hidden"
    hidden = "hidden"


class PostCreate(BaseModel):
    address: str = Field(min_length=1, max_length=512)
    body: str = Field(min_length=1, max_length=5000)
    scope: PostScope = PostScope.r1km


class LocationInfo(BaseModel):
    id: uuid.UUID
    display_address: str
    geohash: str


class PostResponse(BaseModel):
    id: uuid.UUID
    body: str
    scope: PostScope
    location: LocationInfo
    distance_m: float | None = None
    created_at: datetime
    pseudonym: str | None = None
    new_neighbour: bool = True


class FeedItem(BaseModel):
    id: uuid.UUID
    body: str
    scope: PostScope
    display_address: str
    geohash: str
    distance_m: float | None = None
    created_at: datetime
    pseudonym: str | None = None
    new_neighbour: bool = True


class FeedResponse(BaseModel):
    posts: list[FeedItem]
    effective_radius_m: int
    target_count: int
