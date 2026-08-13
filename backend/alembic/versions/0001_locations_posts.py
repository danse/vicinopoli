"""locations and posts

Revision ID: 0001_locations_posts
Revises:
Create Date: 2026-08-13
"""

from collections.abc import Sequence

import geoalchemy2
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0001_locations_posts"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "locations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("normalized_key", sa.String(length=512), nullable=False),
        sa.Column("display_address", sa.String(length=512), nullable=False),
        sa.Column(
            "point",
            geoalchemy2.Geography(
                geometry_type="POINT",
                srid=4326,
                spatial_index=False,
            ),
            nullable=False,
        ),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("geohash", sa.String(length=16), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("normalized_key"),
    )
    op.create_index("ix_locations_normalized_key", "locations", ["normalized_key"])
    op.create_index("ix_locations_geohash", "locations", ["geohash"])
    op.execute("CREATE INDEX ix_locations_point ON locations USING GIST (point)")

    op.create_table(
        "posts",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "location_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("locations.id"),
            nullable=False,
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("scope", sa.String(length=16), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_posts_location_id", "posts", ["location_id"])


def downgrade() -> None:
    op.drop_index("ix_posts_location_id", table_name="posts")
    op.drop_table("posts")
    op.drop_index("ix_locations_point", table_name="locations")
    op.drop_index("ix_locations_geohash", table_name="locations")
    op.drop_index("ix_locations_normalized_key", table_name="locations")
    op.drop_table("locations")
