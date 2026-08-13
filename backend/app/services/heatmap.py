"""Heatmap service (ADR 0008): density-only cell aggregates.

- ``bump_activity_cell`` / ``shrink_activity_cell`` maintain the ``activity_cells``
  table on write (post creation / report auto-hide).
- ``heatmap_tile`` resolves a slippy-map tile to the ``activity_cells`` rows that
  intersect its bounds and returns GeoJSON cell polygons, never raw points.
"""

from __future__ import annotations

import math
from typing import Any, Final

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.geocoder import geohash_decode
from app.models.activity_cell import ActivityCell
from app.models.location import Location
from app.schemas.heatmap import HeatmapTileResponse

# Cell granularity for heatmap aggregation (geohash prefix length).
CELL_PRECISION: Final[int] = 6

# Degrees of margin added to a tile bounds when querying cells, so that cells
# straddling the tile edge are still considered for exact overlap.
MARGIN_DEG: Final[float] = 0.05

MAX_ZOOM: Final[int] = 22


def _cell_bounds(cell: str) -> tuple[float, float, float, float]:
    """``(lat_min, lon_min, lat_max, lon_max)`` for a heatmap cell id."""
    return geohash_decode(cell)


def cell_for(location: Location) -> str:
    """The heatmap cell id covering a post location."""
    return location.geohash[:CELL_PRECISION]


def cell_center(cell: str) -> tuple[float, float]:
    """Centre ``(latitude, longitude)`` of a heatmap cell."""
    lat_min, lon_min, lat_max, lon_max = _cell_bounds(cell)
    return (lat_min + lat_max) / 2, (lon_min + lon_max) / 2


async def _adjust_cell(
    session: AsyncSession, location: Location, by: int
) -> None:
    """Increment/``shrink`` the activity cell for a post location."""
    cell = cell_for(location)
    latitude, longitude = cell_center(cell)
    stmt = pg_insert(ActivityCell).values(
        cell=cell,
        latitude=latitude,
        longitude=longitude,
        post_count=by,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[ActivityCell.cell],
        set_={
            "latitude": latitude,
            "longitude": longitude,
            "post_count": func.greatest(
                ActivityCell.post_count + stmt.excluded.post_count, 0
            ),
        },
    )
    await session.execute(stmt)


async def bump_activity_cell(session: AsyncSession, location: Location) -> None:
    """Record a new active post in its heatmap cell."""
    await _adjust_cell(session, location, +1)


async def shrink_activity_cell(session: AsyncSession, location: Location) -> None:
    """Remove a post (hidden) from its heatmap cell, clamped at zero."""
    await _adjust_cell(session, location, -1)


def tile_bounds(z: int, x: int, y: int) -> tuple[float, float, float, float]:
    """``(lat_min, lon_min, lat_max, lon_max)`` for a slippy-map tile."""
    n = 1 << z

    def lon(k: float) -> float:
        return k / n * 360.0 - 180.0

    def lat(k: float) -> float:
        return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * k / n))))

    return lat(y + 1), lon(x), lat(y), lon(x + 1)


def _rect_overlaps(
    a: tuple[float, float, float, float],
    b: tuple[float, float, float, float],
) -> bool:
    a_lat_min, a_lon_min, a_lat_max, a_lon_max = a
    b_lat_min, b_lon_min, b_lat_max, b_lon_max = b
    lat_overlap = a_lat_min <= b_lat_max and a_lat_max >= b_lat_min
    lon_overlap = a_lon_min <= b_lon_max and a_lon_max >= b_lon_min
    return lat_overlap and lon_overlap


def _cell_to_feature(cell: str, count: int) -> dict[str, Any]:
    lat_min, lon_min, lat_max, lon_max = _cell_bounds(cell)
    ring = [
        [lon_min, lat_min],
        [lon_max, lat_min],
        [lon_max, lat_max],
        [lon_min, lat_max],
        [lon_min, lat_min],
    ]
    return {
        "type": "Feature",
        "properties": {"cell": cell, "count": count},
        "geometry": {"type": "Polygon", "coordinates": [ring]},
    }


def _feature_collection(features: list[dict[str, Any]]) -> HeatmapTileResponse:
    return HeatmapTileResponse(type="FeatureCollection", features=features)


async def heatmap_tile(
    session: AsyncSession, z: int, x: int, y: int
) -> HeatmapTileResponse:
    """Return the density cells intersecting a slippy-map tile."""
    n = 1 << z
    if not (0 <= z <= MAX_ZOOM and 0 <= x < n and 0 <= y < n):
        return _feature_collection([])

    lat_min, lon_min, lat_max, lon_max = tile_bounds(z, x, y)
    rows = await session.execute(
        select(ActivityCell.cell, ActivityCell.post_count).where(
            ActivityCell.post_count > 0,
            ActivityCell.latitude >= lat_min - MARGIN_DEG,
            ActivityCell.latitude <= lat_max + MARGIN_DEG,
            ActivityCell.longitude >= lon_min - MARGIN_DEG,
            ActivityCell.longitude <= lon_max + MARGIN_DEG,
        )
    )

    tile_rect = (lat_min, lon_min, lat_max, lon_max)
    features: list[dict[str, Any]] = []
    for cell, count in rows.all():
        if _rect_overlaps(_cell_bounds(cell), tile_rect):
            features.append(_cell_to_feature(cell, count))
    return _feature_collection(features)


async def coarse_geocode_location(location: Location) -> tuple[str, float, float]:
    """Privacy-safe location summary: coarse cell id + its centre.

    Exact coordinates never leave the server; callers wire this into the
    heatmap/geocode responses instead of latitude/longitude.
    """
    cell = cell_for(location)
    latitude, longitude = cell_center(cell)
    return cell, latitude, longitude