"""Pydantic schemas for the activity heatmap and coarse geocoding (ADR 0008).

The heatmap contract is a GeoJSON ``FeatureCollection`` where each feature is a
geohash cell polygon carrying ``properties.count`` — density only, never
individual points or post content. ``GeocodeResponse`` mirrors that privacy
stance: it returns the coarse cell centre, not the exact coordinates.
"""

from typing import Any

from pydantic import BaseModel, Field


class HeatmapTileResponse(BaseModel):
    type: str = "FeatureCollection"
    features: list[dict[str, Any]] = Field(default_factory=list)


class GeocodeResponse(BaseModel):
    display_address: str
    cell: str
    cell_center_latitude: float
    cell_center_longitude: float


class GeocodeSuggestResponse(BaseModel):
    """Autocomplete results: display strings only, never coordinates."""

    suggestions: list[str]


class GeocodeReverseResponse(BaseModel):
    """Nearest address for a coordinate (for pre-filling the address page)."""

    display_address: str