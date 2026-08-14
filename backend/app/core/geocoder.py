"""Geocoding: address -> coordinates + normalized address key.

The app talks to geocoders only through the :class:`Geocoder` interface. Two
implementations exist:

- :class:`NominatimGeocoder` — production implementation backed by a
  Nominatim-compatible API, with an in-memory TTL cache.
- :class:`StaticGeocoder` — deterministic lookup for development and tests
  (the dev stack runs in ``static`` mode so e2e/unit tests are repeatable).

Privacy rule: we never log raw addresses or exact coordinates — callers use the
returned ``geohash`` / normalized key only.
"""

from __future__ import annotations

import re
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Final

import httpx

_BASE32: Final[str] = "0123456789bcdefghjkmnpqrstuvwxyz"

# Deterministic map used by StaticGeocoder (dev + tests).
# key -> (latitude, longitude, display address)
STATIC_ADDRESSES: Final[dict[str, tuple[float, float, str]]] = {
    "via roma 1, roma": (41.8933, 12.4829, "Via Roma 1, Roma"),
    "piazza venezia, roma": (41.8957, 12.4823, "Piazza Venezia, Roma"),
    "milano centrale, milano": (45.4861, 9.204, "Milano Centrale, Milano"),
}


@dataclass(frozen=True)
class GeocodedAddress:
    """A resolved address with the data we are allowed to persist."""

    normalized_key: str
    display_address: str
    latitude: float
    longitude: float
    geohash: str


def normalize_address(address: str) -> str:
    """Collapse to a stable, lowercase key for deduplication.

    Only used for the normalized key / cache — the raw string is never logged.
    """
    return re.sub(r"\s+", " ", address).strip().lower()


def geohash_encode(latitude: float, longitude: float, precision: int = 9) -> str:
    """Standard base32 geohash encoder (used for the stored cell id)."""
    lat_range = [-90.0, 90.0]
    lon_range = [-180.0, 180.0]
    bits: list[int] = []
    even = True
    while len(bits) < precision * 5:
        if even:
            mid = (lon_range[0] + lon_range[1]) / 2
            if longitude > mid:
                lon_range[0] = mid
                bits.append(1)
            else:
                lon_range[1] = mid
                bits.append(0)
        else:
            mid = (lat_range[0] + lat_range[1]) / 2
            if latitude > mid:
                lat_range[0] = mid
                bits.append(1)
            else:
                lat_range[1] = mid
                bits.append(0)
        even = not even

    chars: list[str] = []
    for i in range(0, len(bits), 5):
        value = 0
        for bit in bits[i : i + 5]:
            value = (value << 1) | bit
        chars.append(_BASE32[value])
    return "".join(chars)


def geohash_decode(cell: str) -> tuple[float, float, float, float]:
    """Decode a geohash cell into ``(lat_min, lon_min, lat_max, lon_max)``.

    Inverse of :func:`geohash_encode`; used to turn a stored cell id into the
    rectangle it covers (heatmap tile geometry).
    """
    lat_range = [-90.0, 90.0]
    lon_range = [-180.0, 180.0]
    even = True
    for char in cell:
        value = _BASE32.index(char)
        for bit_shift in range(4, -1, -1):
            bit = (value >> bit_shift) & 1
            if even:
                mid = (lon_range[0] + lon_range[1]) / 2
                if bit:
                    lon_range[0] = mid
                else:
                    lon_range[1] = mid
            else:
                mid = (lat_range[0] + lat_range[1]) / 2
                if bit:
                    lat_range[0] = mid
                else:
                    lat_range[1] = mid
            even = not even
    lat_min, lat_max = lat_range
    lon_min, lon_max = lon_range
    return lat_min, lon_min, lat_max, lon_max


class Geocoder(ABC):
    """Interface implemented by every geocoder."""

    @abstractmethod
    async def geocode(self, address: str) -> GeocodedAddress | None:
        """Resolve an address; ``None`` when it cannot be resolved."""

    @abstractmethod
    async def suggest(self, query: str, limit: int = 6) -> list[str]:
        """Return display-address suggestions matching a partial query.

        Only display strings come back — never coordinates or geohashes — so
        the privacy stance of :mod:`app.core.geocoder` holds for autocomplete.
        """


class StaticGeocoder(Geocoder):
    """Deterministic geocoder for development and tests."""

    def __init__(self, addresses: dict[str, tuple[float, float, str]] | None = None) -> None:
        self._addresses = addresses or STATIC_ADDRESSES

    async def geocode(self, address: str) -> GeocodedAddress | None:
        key = normalize_address(address)
        entry = self._addresses.get(key)
        if entry is None:
            return None
        latitude, longitude, display = entry
        return GeocodedAddress(
            normalized_key=key,
            display_address=display,
            latitude=latitude,
            longitude=longitude,
            geohash=geohash_encode(latitude, longitude),
        )

    async def suggest(self, query: str, limit: int = 6) -> list[str]:
        needle = normalize_address(query)
        if limit <= 0:
            return []
        results = [
            display
            for key, (*_coords, display) in self._addresses.items()
            if needle in key
        ]
        return results[:limit]


class NominatimGeocoder(Geocoder):
    """Nominatim-backed geocoder with an in-memory TTL cache."""

    def __init__(self, base_url: str, ttl_seconds: int = 86400, timeout: float = 10.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._ttl_seconds = ttl_seconds
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            headers={"User-Agent": "vicinopoli/0.1 (https://github.com/vicinopoli/vicinopoli)"},
            timeout=timeout,
        )
        self._cache: dict[str, tuple[float, GeocodedAddress]] = {}

    async def _fetch(self, params: dict[str, str]) -> httpx.Response:
        """Separated for testability."""
        return await self._client.get("/search", params=params)

    async def geocode(self, address: str) -> GeocodedAddress | None:
        cache_key = normalize_address(address)
        cached = self._cache.get(cache_key)
        if cached is not None and time.monotonic() - cached[0] < self._ttl_seconds:
            return cached[1]

        response = await self._fetch({"q": address, "format": "jsonv2", "limit": "1"})
        response.raise_for_status()
        results = response.json()
        if not results:
            return None

        first = results[0]
        latitude = float(first["lat"])
        longitude = float(first["lon"])
        result = GeocodedAddress(
            normalized_key=cache_key,
            display_address=first.get("display_name") or address,
            latitude=latitude,
            longitude=longitude,
            geohash=geohash_encode(latitude, longitude),
        )
        self._cache[cache_key] = (time.monotonic(), result)
        return result

    async def suggest(self, query: str, limit: int = 6) -> list[str]:
        response = await self._fetch(
            {"q": query, "format": "jsonv2", "limit": str(limit)}
        )
        response.raise_for_status()
        results = response.json()
        return [item.get("display_name") or query for item in results]


def build_geocoder(mode: str, base_url: str, ttl_seconds: int) -> Geocoder:
    """Factory used by the FastAPI dependency."""
    if mode == "nominatim":
        return NominatimGeocoder(base_url, ttl_seconds=ttl_seconds)
    return StaticGeocoder()
