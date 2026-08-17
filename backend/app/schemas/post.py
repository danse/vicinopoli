"""Pydantic schemas for posts and the feed.

These are the single source of truth for the API contract; TypeScript types are
generated from them via ``make gen``.
"""

import uuid
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field, model_validator

from app.schemas.media import MediaInfo


class PostScope(StrEnum):
    street = "street"
    r500m = "500m"
    r1km = "1km"
    r5km = "5km"


class PostVoice(StrEnum):
    """The author's voice intent (fuzzy, user-facing): who should read this.

    Unlike ``PostScope`` (a fixed km), the voice is converted to a distance at
    feed-serve time via the neighbour-count conversion (plan: Reach model).
    ``street`` yields ``reach_m = 0`` (same normalized address key).
    """

    street = "street"
    some = "some"
    area = "area"
    city = "city"


class PostStatus(StrEnum):
    active = "active"
    auto_hidden = "auto_hidden"
    hidden = "hidden"


class PostCreate(BaseModel):
    address: str = Field(min_length=1, max_length=512)
    body: str = Field(default="", max_length=5000)
    voice: PostVoice = PostVoice.city
    scope: PostScope | None = None
    media_ids: list[uuid.UUID] = Field(default_factory=list, max_length=9)

    @model_validator(mode="after")
    def _require_text_or_media(self) -> "PostCreate":
        if not self.body.strip() and not self.media_ids:
            raise ValueError("a post needs text or at least one media item")
        return self


class LocationInfo(BaseModel):
    id: uuid.UUID
    display_address: str
    geohash: str


class PostResponse(BaseModel):
    id: uuid.UUID
    body: str
    scope: PostScope | None = None
    voice: PostVoice
    location: LocationInfo
    distance_m: float | None = None
    created_at: datetime
    pseudonym: str | None = None
    new_neighbour: bool = True
    daily_post_limit: int | None = None
    posts_left_today: int | None = None
    media: list[MediaInfo] = Field(default_factory=list)


class FeedItem(BaseModel):
    id: uuid.UUID
    body: str
    scope: PostScope | None = None
    voice: PostVoice
    display_address: str
    geohash: str
    distance_m: float | None = None
    created_at: datetime
    pseudonym: str | None = None
    new_neighbour: bool = True
    media: list[MediaInfo] = Field(default_factory=list)


class FeedResponse(BaseModel):
    posts: list[FeedItem]
    effective_radius_m: int
    target_count: int
    next_cursor: str | None = None
