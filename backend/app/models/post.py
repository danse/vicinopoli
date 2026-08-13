"""Post model: a text post anchored to a location, with a visibility scope.

Scope semantics follow ADR 0006 — ``scope`` is the author's max reach and the
feed applies the asymmetric intersection rule in a single query.
"""

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.location import Location


class PostScope(StrEnum):
    building = "building"
    r500m = "500m"
    r1km = "1km"
    r5km = "5km"


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    location_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("locations.id"), index=True
    )
    location: Mapped[Location] = relationship()
    body: Mapped[str] = mapped_column(Text)
    scope: Mapped[PostScope] = mapped_column(String(16), default=PostScope.r1km)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
