"""post voice intent

Adds the ``voice`` column (building/some/area/city) replacing the km-based
``scope`` cap. The legacy ``scope`` column is kept, nullable, for
backwards compatibility with old clients.

Revision ID: 0006_post_voice
Revises: 0005_heatmap
Create Date: 2026-08-14
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0006_post_voice"
down_revision: str = "0005_heatmap"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None

_VOICE_TYPES = ("building", "some", "area", "city")


def upgrade() -> None:
    op.add_column("posts", sa.Column("voice", sa.String(length=16), nullable=True))
    # Backfill existing rows: a km ``scope`` maps onto the voice model, others
    # default to ``city`` (the broadest intent, per "default reach is longest").
    op.execute(
        """
        UPDATE posts SET voice = CASE
            WHEN scope = 'building' THEN 'building'
            WHEN scope = '5km' THEN 'area'
            WHEN scope IN ('500m', '1km') THEN 'some'
            ELSE 'city'
        END
        """
    )
    op.alter_column("posts", "voice", nullable=False)
    op.alter_column("posts", "scope", nullable=True)


def downgrade() -> None:
    op.drop_column("posts", "voice")
