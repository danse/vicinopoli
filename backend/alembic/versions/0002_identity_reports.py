"""devices, reports, post author + status

Revision ID: 0002_identity_reports
Revises: 0001_locations_posts
Create Date: 2026-08-13
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0002_identity_reports"
down_revision: str = "0001_locations_posts"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "devices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("pseudonym", sa.String(length=40), nullable=True),
        sa.Column("trust_score", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "status",
            sa.String(length=16),
            server_default="active",
            nullable=False,
        ),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.add_column("posts", sa.Column("device_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index("ix_posts_device_id", "posts", ["device_id"])
    op.create_foreign_key("fk_posts_device_id_devices", "posts", "devices", ["device_id"], ["id"])
    op.add_column(
        "posts",
        sa.Column("status", sa.String(length=16), server_default="active", nullable=False),
    )
    op.create_table(
        "reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("post_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("device_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "status",
            sa.String(length=16),
            server_default="submitted",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"]),
        sa.ForeignKeyConstraint(["post_id"], ["posts.id"]),
        sa.UniqueConstraint("post_id", "device_id", name="uq_report_post_device"),
    )
    op.create_index("ix_reports_post_id", "reports", ["post_id"])
    op.create_index("ix_reports_device_id", "reports", ["device_id"])


def downgrade() -> None:
    op.drop_index("ix_reports_device_id", table_name="reports")
    op.drop_index("ix_reports_post_id", table_name="reports")
    op.drop_table("reports")
    op.drop_column("posts", "status")
    op.drop_constraint("fk_posts_device_id_devices", "posts", type_="foreignkey")
    op.drop_index("ix_posts_device_id", table_name="posts")
    op.drop_column("posts", "device_id")
    op.drop_table("devices")
