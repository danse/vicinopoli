"""Pydantic schemas for media uploads (ADR 0013).

Single source of truth for the API contract; TypeScript types are generated
from these via ``make gen``.
"""

import uuid

from pydantic import BaseModel, Field


class MediaPresignRequest(BaseModel):
    kind: str = Field(pattern="^(image|voice)$")
    content_type: str = Field(min_length=1, max_length=128)
    size: int = Field(ge=1)
    filename: str | None = Field(default=None, max_length=255)


class MediaPresignResponse(BaseModel):
    object_key: str
    url: str
    kind: str
    content_type: str
    size: int


class MediaRegisterRequest(BaseModel):
    kind: str = Field(pattern="^(image|voice)$")
    object_key: str = Field(min_length=1, max_length=512)
    content_type: str = Field(min_length=1, max_length=128)
    size: int = Field(ge=1)
    duration_s: float | None = None


class MediaInfo(BaseModel):
    id: uuid.UUID
    kind: str
    url: str
    duration_s: float | None = None


class MediaRegistered(BaseModel):
    id: uuid.UUID
    kind: str
    object_key: str
    content_type: str
    size: int