"""experiments + analytics events

Revision ID: 0004_experiments
Revises: 0003_media
Create Date: 2026-08-13
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0004_experiments"
down_revision: str = "0003_media"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "devices",
        sa.Column("experiment_segment", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "devices",
        sa.Column("analytics_consent", sa.Boolean(), nullable=True),
    )
    op.create_table(
        "analytics_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "device_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("devices.id"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=40), nullable=False),
        sa.Column("geohash", sa.String(length=32), nullable=True),
        sa.Column("post_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_analytics_events_device_id", "analytics_events", ["device_id"])


def downgrade() -> None:
    op.drop_index("ix_analytics_events_device_id", table_name="analytics_events")
    op.drop_table("analytics_events")
    op.drop_column("devices", "analytics_consent")
    op.drop_column("devices", "experiment_segment")