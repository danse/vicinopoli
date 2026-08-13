"""Device model: anonymous device identity with optional pseudonym.

Per ADR 0005 the device token is an httpOnly cookie created on first visit; the
only server-side identity. ``trust_score`` underpins the trust ladder: new
devices post immediately but with reduced reach until they accrue trust.
"""

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class DeviceStatus(StrEnum):
    active = "active"
    banned = "banned"


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pseudonym: Mapped[str | None] = mapped_column(String(40), nullable=True)
    trust_score: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    status: Mapped[DeviceStatus] = mapped_column(
        SAEnum(DeviceStatus, native_enum=False, length=16), default=DeviceStatus.active
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=True, server_default=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
