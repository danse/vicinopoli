"""analytics_events.occurred_at

Revision ID: 0009_analytics_occurred_at
Revises: 0008_push_subscriptions
Create Date: 2026-08-20
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0009_analytics_occurred_at"
down_revision: str = "0008_push_subscriptions"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "analytics_events",
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("analytics_events", "occurred_at")