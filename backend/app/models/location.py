"""Location model: one canonical row per normalized address.

Per ADR 0004 the location holds a ``geography`` point (GiST-indexed via
GeoAlchemy2) plus latitude/longitude and a geohash cell. Posts reference a
location, never raw coordinates.
"""

import uuid
from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import DateTime, Float, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    normalized_key: Mapped[str] = mapped_column(String(512), unique=True, index=True)
    display_address: Mapped[str] = mapped_column(String(512))
    point = mapped_column(Geography(geometry_type="POINT", srid=4326))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    geohash: Mapped[str] = mapped_column(String(16), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
