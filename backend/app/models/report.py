"""Report model: user-initiated moderation signal (ADR 0009).

Reports follow a state machine: ``submitted`` -> auto-hide at N distinct-device
reports -> ``pending`` -> ``dismissed`` | ``hidden`` | ``banned_device``. The
feed excludes posts that are hidden or auto-hidden.
"""

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.device import Device
from app.models.post import Post


class ReportStatus(StrEnum):
    submitted = "submitted"
    pending = "pending"
    dismissed = "dismissed"
    hidden = "hidden"


class Report(Base):
    __tablename__ = "reports"
    __table_args__ = (UniqueConstraint("post_id", "device_id", name="uq_report_post_device"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("posts.id"), index=True
    )
    post: Mapped[Post] = relationship()
    device_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("devices.id"))
    device: Mapped[Device] = relationship()
    status: Mapped[ReportStatus] = mapped_column(
        SAEnum(ReportStatus, native_enum=False, length=16), default=ReportStatus.submitted
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
