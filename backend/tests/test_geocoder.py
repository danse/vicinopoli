"""Geocoder unit tests (no DB)."""

import pytest

from app.core.geocoder import (
    GeocodedAddress,
    NominatimGeocoder,
    StaticGeocoder,
    geohash_encode,
    normalize_address,
)


def test_normalize_address_collapses_whitespace() -> None:
    assert normalize_address("  Via    Roma 1,  Roma ") == "via roma 1, roma"


def test_geohash_encode_is_stable() -> None:
    assert geohash_encode(41.8933, 12.4829) == geohash_encode(41.8933, 12.4829)
    assert geohash_encode(41.8, 12.4) != geohash_encode(45.4, 9.2)


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
