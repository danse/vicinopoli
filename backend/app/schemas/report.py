"""Pydantic schemas for the report workflow (ADR 0009).

Single source of truth for the API contract; TypeScript types are generated
from these via ``make gen``.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.post import PostStatus


class ReportCreate(BaseModel):
    pass


class ReportResponse(BaseModel):
    id: uuid.UUID
    post_id: uuid.UUID
    status: str
    post_status: PostStatus
    created_at: datetime


class PostReportResponse(BaseModel):
    reported: bool
