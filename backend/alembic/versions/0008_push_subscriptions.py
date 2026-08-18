"""push subscriptions

Adds ``push_subscriptions``: one Web Push subscription per device, storing only
the device's area as a geohash cell centre (never the address or an exact
point) per ADR 0025.

Revision ID: 0008_push_subscriptions
Revises: 0007_street_voice
Create Date: 2026-08-18
"""

from collections.abc import Sequence

import sqlalchemy as sa
from geoalchemy2 import Geography

from alembic import op

revision: str = "0008_push_subscriptions"
down_revision: str = "0007_street_voice"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "push_subscriptions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("device_id", sa.UUID(), nullable=False),
        sa.Column("endpoint", sa.String(length=512), nullable=False),
        sa.Column("p256dh", sa.String(length=256), nullable=False),
        sa.Column("auth", sa.String(length=256), nullable=False),
        sa.Column("point", Geography(geometry_type="POINT", srid=4326), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("geohash", sa.String(length=16), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_push_subscriptions_endpoint", "push_subscriptions", ["endpoint"], unique=True
    )
    op.create_index(
        "ix_push_subscriptions_device_id", "push_subscriptions", ["device_id"], unique=False
    )
    op.create_index(
        "ix_push_subscriptions_geohash", "push_subscriptions", ["geohash"], unique=False
    )
    # NB: no explicit index on `point`: the Geography column creates its own
    # spatial GiST index named idx_push_subscriptions_point on table creation.


def downgrade() -> None:
    op.drop_table("push_subscriptions")