"""rename building voice to street

Photon does not provide street numbers, so the finest granularity we can offer
is the street, not the building. Renames the ``building`` value to ``street``
in both the ``voice`` and the legacy ``scope`` columns.

Revision ID: 0007_street_voice
Revises: 0006_post_voice
Create Date: 2026-08-17
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0007_street_voice"
down_revision: str = "0006_post_voice"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.execute("UPDATE posts SET voice = 'street' WHERE voice = 'building'")
    op.execute("UPDATE posts SET scope = 'street' WHERE scope = 'building'")


def downgrade() -> None:
    op.execute("UPDATE posts SET voice = 'building' WHERE voice = 'street'")
    op.execute("UPDATE posts SET scope = 'building' WHERE scope = 'street'")
