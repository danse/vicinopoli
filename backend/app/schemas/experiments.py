"""Pydantic schemas for analytics events (ADR 0014).

Single source of truth for the API contract; TypeScript types are generated
from these via ``make gen``.
"""

from datetime import datetime
from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class EventName(StrEnum):
    post_viewed = "post_viewed"
    post_created = "post_created"
    onboarding_completed = "onboarding_completed"
    address_set = "address_set"


class AnalyticsEventInput(BaseModel):
    name: EventName
    geohash: str | None = Field(default=None, max_length=32)
    post_id: UUID | None = None
    occurred_at: datetime | None = None


class AnalyticsEventBatch(BaseModel):
    events: list[AnalyticsEventInput] = Field(default_factory=list, max_length=100)


class AnalyticsEventResult(BaseModel):
    accepted: int
    stored: int


DeviceConsent = Literal[True, False]