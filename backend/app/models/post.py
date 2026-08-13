"""Post model: a text post anchored to a location, with a visibility scope.

Scope semantics follow ADR 0006 — ``scope`` is the author's max reach and the
feed applies the asymmetric intersection rule in a single query. The enums are
defined in ``app.schemas.post`` (source of truth for the API contract) and
reused here for the DB columns.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.device import Device
from app.models.location import Location
from app.schemas.post import PostScope, PostStatus

__all__ = ["Post", "PostScope", "PostStatus"]


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    location_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("locations.id"), index=True
    )
    location: Mapped[Location] = relationship()
    device_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("devices.id"), nullable=True, index=True
    )
    device: Mapped[Device | None] = relationship()
    body: Mapped[str] = mapped_column(Text)
    scope: Mapped[PostScope] = mapped_column(
        SAEnum(PostScope, native_enum=False, length=16), default=PostScope.r1km
    )
    status: Mapped[PostStatus] = mapped_column(
        SAEnum(PostStatus, native_enum=False, length=16), default=PostStatus.active
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
