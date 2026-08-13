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
    created_at: datetime


class DeviceUpdate(BaseModel):
    pseudonym: str | None = Field(default=None, min_length=0, max_length=40)
