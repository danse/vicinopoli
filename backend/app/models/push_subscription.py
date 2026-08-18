"""Push subscription model: one Web Push subscription per device.

Per ADR 0025 the subscription stores only the device's area as a geohash cell
centre (mirroring ``locations`` and ``activity_cells``) — never the raw address
or exact coordinates. The cell is updated when the device re-subscribes from a
new address, so notifications follow the user's current area.
"""

import uuid
from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import DateTime, Float, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("devices.id"), index=True
    )
    endpoint: Mapped[str] = mapped_column(String(512), unique=True, index=True)
    p256dh: Mapped[str] = mapped_column(String(256))
    auth: Mapped[str] = mapped_column(String(256))
    # The device's area as a geohash cell centre (privacy: never an exact point).
    point = mapped_column(Geography(geometry_type="POINT", srid=4326))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    geohash: Mapped[str] = mapped_column(String(16), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())