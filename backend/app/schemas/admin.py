"""Pydantic schemas for the internal admin firehose (ADR 0021).

Single source of truth for the API contract; TypeScript types are generated
from these via ``make gen``. The firehose is read-only in this iteration: it
lists every post (active, auto-hidden, hidden) for human review. Coordinates
are never included — only the geohash cell and the reverse-geocoded display
address, both already exposed by the public feed.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.media import MediaInfo
from app.schemas.post import PostStatus, PostVoice


class AdminPost(BaseModel):
    id: uuid.UUID
    body: str
    voice: PostVoice
    status: PostStatus
    display_address: str
    geohash: str
    created_at: datetime
    pseudonym: str | None = None
    new_neighbour: bool = True
    report_count: int = 0
    device_id: uuid.UUID | None = None
    media: list[MediaInfo] = Field(default_factory=list)


class AdminFeedResponse(BaseModel):
    posts: list[AdminPost]
    next_cursor: str | None = None
