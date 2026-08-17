"""Heatmap and coarse-geocode endpoints (ADR 0008).

- ``GET /api/heatmap/{z}/{x}/{y}`` — density-only cell aggregates for a
  slippy-map tile, as GeoJSON cell polygons. Never individual points or posts.
- ``GET /api/geocode?address=...`` — resolves an address to a coarse cell id
  and its centre (never the exact coordinates), so the client can centre a
  map without learning precise locations.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_geocoder, get_session
from app.core.geocoder import Geocoder
from app.schemas.heatmap import (
    GeocodeResponse,
    GeocodeReverseResponse,
    GeocodeSuggestResponse,
    HeatmapTileResponse,
)
from app.services.heatmap import CELL_PRECISION, MAX_ZOOM, cell_center, heatmap_tile

router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_session)]
GeocoderDep = Annotated[Geocoder, Depends(get_geocoder)]


@router.get("/heatmap/{z}/{x}/{y}", response_model=HeatmapTileResponse)
async def get_heatmap_tile(
    z: int,
    x: int,
    y: int,
    session: SessionDep,
) -> HeatmapTileResponse:
    if not (0 <= z <= MAX_ZOOM):
        raise HTTPException(status_code=422, detail="zoom out of range")
    limit = 1 << z
    if not (0 <= x < limit and 0 <= y < limit):
        raise HTTPException(status_code=422, detail="tile coordinate out of range")
    return await heatmap_tile(session, z, x, y)


@router.get("/geocode/suggest", response_model=GeocodeSuggestResponse)
async def suggest_geocode(
    geocoder: GeocoderDep,
    q: str = Query(min_length=1, max_length=512),
    limit: int = Query(default=6, ge=1, le=20),
) -> GeocodeSuggestResponse:
    """Autocomplete an address from a partial query (display strings only)."""
    suggestions = await geocoder.suggest(q, limit)
    return GeocodeSuggestResponse(suggestions=suggestions)


@router.get("/geocode/reverse", response_model=GeocodeReverseResponse)
async def reverse_geocode(
    geocoder: GeocoderDep,
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
) -> GeocodeReverseResponse:
    """Resolve a browser-location coordinate to the nearest address.

    Used to pre-fill the address page. Only the display string is returned;
    the coordinate is used for the lookup and never stored or logged.
    """
    geocoded = await geocoder.reverse(lat, lon)
    if geocoded is None:
        raise HTTPException(status_code=404, detail="address not found")
    return GeocodeReverseResponse(display_address=geocoded.display_address)


@router.get("/geocode", response_model=GeocodeResponse)
async def geocode(
    session: SessionDep,
    geocoder: GeocoderDep,
    address: str = Query(min_length=1, max_length=512),
) -> GeocodeResponse:
    geocoded = await geocoder.geocode(address)
    if geocoded is None:
        raise HTTPException(status_code=404, detail="address not found")
    cell = geocoded.geohash[:CELL_PRECISION]
    latitude, longitude = cell_center(cell)
    return GeocodeResponse(
        display_address=geocoded.display_address,
        cell=cell,
        cell_center_latitude=latitude,
        cell_center_longitude=longitude,
    )