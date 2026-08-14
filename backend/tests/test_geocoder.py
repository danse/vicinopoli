"""Geocoder unit tests (no DB)."""

import pytest

from app.core.geocoder import (
    GeocodedAddress,
    NominatimGeocoder,
    StaticGeocoder,
    geohash_decode,
    geohash_encode,
    normalize_address,
)


def test_normalize_address_collapses_whitespace() -> None:
    assert normalize_address("  Via    Roma 1,  Roma ") == "via roma 1, roma"


def test_geohash_encode_is_stable() -> None:
    assert geohash_encode(41.8933, 12.4829) == geohash_encode(41.8933, 12.4829)
    assert geohash_encode(41.8, 12.4) != geohash_encode(45.4, 9.2)


def test_geohash_decode_returns_cell_bounds() -> None:
    lat, lon = 41.8933, 12.4829
    cell = geohash_encode(lat, lon, precision=5)
    lat_min, lon_min, lat_max, lon_max = geohash_decode(cell)
    assert lat_min <= lat <= lat_max
    assert lon_min <= lon <= lon_max
    # The cell is a rectangle: each edge covers a known span at precision 5.
    assert lat_max - lat_min > 0
    assert lon_max - lon_min > 0


def test_geohash_decode_roundtrip_within_cell_edge() -> None:
    cell = geohash_encode(0.0, 0.0, precision=4)
    lat_min, lon_min, lat_max, lon_max = geohash_decode(cell)
    # The decoded bounds are the same cell the encoder produced for its centre.
    corner_lat = (lat_min + lat_max) / 2
    corner_lon = (lon_min + lon_max) / 2
    assert geohash_encode(corner_lat, corner_lon, precision=4) == cell


@pytest.mark.asyncio
async def test_static_geocoder_resolves_known_addresses() -> None:
    geocoder = StaticGeocoder()
    result = await geocoder.geocode("Via Roma 1, Roma")
    assert isinstance(result, GeocodedAddress)
    assert result.normalized_key == "via roma 1, roma"
    assert result.geohash
    assert result.latitude != 0.0


@pytest.mark.asyncio
async def test_static_geocoder_returns_none_for_unknown() -> None:
    geocoder = StaticGeocoder()
    assert await geocoder.geocode("Via Inesistente 99, Nowhere") is None


@pytest.mark.asyncio
async def test_nominatim_geocoder_caches_results() -> None:
    calls = {"count": 0}

    class FakeClient:
        async def get(self, url, params):
            calls["count"] += 1
            return (
                FakeResponse(
                    [
                        {
                            "lat": "41.8933",
                            "lon": "12.4829",
                            "display_name": "Via Roma 1, Roma",
                        }
                    ]
                )
                if calls["count"] == 1
                else None
            )  # pragma: no cover

    class FakeResponse:
        def __init__(self, json):
            self._json = json

        def raise_for_status(self):
            return None

        def json(self):
            return self._json

    geocoder = NominatimGeocoder("https://nominatim.test")

    # Replace the real client with the fake by monkeypatching _fetch.
    async def fake_fetch(params):
        calls["count"] += 1
        return FakeResponse(
            [
                {
                    "lat": "41.8933",
                    "lon": "12.4829",
                    "display_name": "Via Roma 1, Roma",
                }
            ]
        )

    geocoder._fetch = fake_fetch  # type: ignore[method-assign]
    first = await geocoder.geocode("Via Roma 1, Roma")
    second = await geocoder.geocode("Via Roma 1, Roma")
    assert first == second
    assert calls["count"] == 1


@pytest.mark.asyncio
async def test_static_geocoder_suggests_matching_addresses() -> None:
    geocoder = StaticGeocoder()
    assert await geocoder.suggest("milano") == ["Milano Centrale, Milano"]
    assert await geocoder.suggest("piazza venezia") == ["Piazza Venezia, Roma"]
    assert await geocoder.suggest("Via") == ["Via Roma 1, Roma"]


@pytest.mark.asyncio
async def test_static_geocoder_suggest_is_case_and_whitespace_insensitive() -> None:
    geocoder = StaticGeocoder()
    assert await geocoder.suggest("  MILANO ") == ["Milano Centrale, Milano"]


@pytest.mark.asyncio
async def test_static_geocoder_suggests_nothing_for_unknown_prefix() -> None:
    geocoder = StaticGeocoder()
    assert await geocoder.suggest("via inesistente") == []


@pytest.mark.asyncio
async def test_static_geocoder_suggest_respects_limit() -> None:
    geocoder = StaticGeocoder()
    assert await geocoder.suggest("via", limit=0) == []


@pytest.mark.asyncio
async def test_nominatim_geocoder_suggest_forwards_query_and_limit() -> None:
    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self):
            return [
                {"display_name": "Via Roma 1, Roma"},
                {"display_name": "Via Roma 1, Milano"},
            ]

    captured: dict[str, str] = {}

    async def fake_fetch(params):
        captured.update(params)
        return FakeResponse()

    geocoder = NominatimGeocoder("https://nominatim.test")
    geocoder._fetch = fake_fetch  # type: ignore[method-assign]

    suggestions = await geocoder.suggest("via roma", limit=2)

    assert suggestions == ["Via Roma 1, Roma", "Via Roma 1, Milano"]
    assert captured["q"] == "via roma"
    assert captured["limit"] == "2"
    assert captured["format"] == "jsonv2"
