"""Activity cell model: precomputed density per geohash cell (ADR 0008).

The heatmap never ships raw points: this table stores one row per geohash cell
with the count of active posts in it, plus the cell centre. Counts are
maintained on write (post creation increments, report auto-hide decrements),
so the client only ever receives density per cell.
"""

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ActivityCell(Base):
    __tablename__ = "activity_cells"

    cell: Mapped[str] = mapped_column(String(16), primary_key=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    post_count: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
