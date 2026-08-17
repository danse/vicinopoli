"""Pydantic schemas for device identity (ADR 0005).

These are the single source of truth for the API contract; TypeScript types are
generated from them via ``make gen``.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class DeviceResponse(BaseModel):
    id: uuid.UUID
    pseudonym: str | None = None
    new_neighbour: bool
    daily_post_limit: int | None = None
    posts_left_today: int | None = None
    created_at: datetime
    experiment_segment: int
    experiment_flags: dict[str, bool]
    analytics_consent: bool | None = None


class DeviceUpdate(BaseModel):
    pseudonym: str | None = Field(default=None, min_length=0, max_length=40)
    analytics_consent: bool | None = None
