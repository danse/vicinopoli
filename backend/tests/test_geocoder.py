"""Geocoder unit tests (no DB)."""

import pytest

from app.core.geocoder import (
    GeocodedAddress,
    NominatimGeocoder,
    PhotonGeocoder,
    StaticGeocoder,
    build_geocoder,
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
async def test_nominatim_geocoder_geocode_raises_on_non_429() -> None:
    """A 5xx (not a rate limit) must still propagate as an error."""
    import httpx

    async def fake_fetch(params):
        return httpx.Response(500, request=httpx.Request("GET", "http://x"))

    geocoder = NominatimGeocoder("https://nominatim.test")
    geocoder._fetch = fake_fetch  # type: ignore[method-assign]

    with pytest.raises(httpx.HTTPStatusError):
        await geocoder.geocode("via roma")


@pytest.mark.asyncio
async def test_nominatim_geocoder_geocode_degrades_on_429() -> None:
    """A rate-limited geocode must degrade to None (treat as not found)."""
    import httpx

    async def fake_fetch(params):
        return httpx.Response(429, request=httpx.Request("GET", "http://x"))

    geocoder = NominatimGeocoder("https://nominatim.test")
    geocoder._fetch = fake_fetch  # type: ignore[method-assign]

    assert await geocoder.geocode("via roma") is None


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
async def test_static_geocoder_reverse_finds_nearest_address() -> None:
    geocoder = StaticGeocoder()
    # Piazza Venezia's own coordinates.
    result = await geocoder.reverse(41.8957, 12.4823)
    assert result is not None
    assert result.display_address == "Piazza Venezia, Roma"


@pytest.mark.asyncio
async def test_static_geocoder_reverse_picks_nearest_from_multiple() -> None:
    geocoder = StaticGeocoder()
    # Between Piazza Venezia and Via Roma, closer to Via Roma.
    result = await geocoder.reverse(41.894, 12.4826)
    assert result is not None
    assert result.display_address == "Via Roma 1, Roma"


@pytest.mark.asyncio
async def test_static_geocoder_reverse_returns_none_far_away() -> None:
    geocoder = StaticGeocoder()
    # Mid-Atlantic: beyond the 100km confidence radius.
    assert await geocoder.reverse(0.0, 0.0) is None


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


@pytest.mark.asyncio
async def test_nominatim_geocoder_suggest_caches_by_query() -> None:
    """Repeated lookups must not hammer the upstream API (429 prevention)."""
    calls: list[dict[str, str]] = []

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self):
            return [{"display_name": f"Via Roma {len(calls)}, Roma"}]

    async def fake_fetch(params):
        calls.append(params)
        return FakeResponse()

    geocoder = NominatimGeocoder("https://nominatim.test")
    geocoder._fetch = fake_fetch  # type: ignore[method-assign]

    first = await geocoder.suggest("via roma 1")
    second = await geocoder.suggest("via roma 1")
    third = await geocoder.suggest("via roma 1")

    assert first == second == third
    assert len(calls) == 1, "suggest must hit the upstream API only once"


@pytest.mark.asyncio
async def test_nominatim_geocoder_suggest_distinct_queries_not_deduped() -> None:
    """Prefix keystrokes are distinct queries and must each be fetched once."""
    calls: list[dict[str, str]] = []

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self):
            return [{"display_name": "Via Roma 1, Roma"}]

    async def fake_fetch(params):
        calls.append(params)
        return FakeResponse()

    geocoder = NominatimGeocoder("https://nominatim.test")
    geocoder._fetch = fake_fetch  # type: ignore[method-assign]

    await geocoder.suggest("via roma 1, r")
    await geocoder.suggest("via roma 1, ro")
    assert len(calls) == 2


@pytest.mark.asyncio
async def test_nominatim_geocoder_suggest_degrades_on_429() -> None:
    """A rate-limited upstream must not crash: return no suggestions instead."""
    import httpx

    async def fake_fetch(params):
        return httpx.Response(429, request=httpx.Request("GET", "http://x"))

    geocoder = NominatimGeocoder("https://nominatim.test")
    geocoder._fetch = fake_fetch  # type: ignore[method-assign]
    suggestions = await geocoder.suggest("via roma")
    assert suggestions == []


@pytest.mark.asyncio
async def test_nominatim_geocoder_reverse_forwards_coordinates() -> None:
    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self):
            return {"lat": "41.8957", "lon": "12.4823", "display_name": "Piazza Venezia, Roma"}

    captured: dict[str, str] = {}

    async def fake_reverse_fetch(params):
        captured.update(params)
        return FakeResponse()

    geocoder = NominatimGeocoder("https://nominatim.test")
    geocoder._reverse_fetch = fake_reverse_fetch  # type: ignore[method-assign]

    result = await geocoder.reverse(41.8957, 12.4823)

    assert result is not None
    assert result.display_address == "Piazza Venezia, Roma"
    assert captured["lat"] == "41.8957"
    assert captured["lon"] == "12.4823"
    assert captured["format"] == "jsonv2"


@pytest.mark.asyncio
async def test_nominatim_geocoder_reverse_returns_none_without_results() -> None:
    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self):
            return {}

    async def fake_reverse_fetch(params):
        return FakeResponse()

    geocoder = NominatimGeocoder("https://nominatim.test")
    geocoder._reverse_fetch = fake_reverse_fetch  # type: ignore[method-assign]

    assert await geocoder.reverse(0.0, 0.0) is None


def _photon_feature(lon: float, lat: float, **properties) -> dict:
    return {
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": properties,
    }


def _photon_response(*features: dict) -> object:
    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self):
            return {"features": list(features)}

    return FakeResponse()


@pytest.mark.asyncio
async def test_photon_geocoder_geocode_parses_feature() -> None:
    async def fake_fetch(params):
        return _photon_response(
            _photon_feature(
                12.4829,
                41.8933,
                name="Via Roma",
                street="Via Roma",
                housenumber="1",
                city="Roma",
                state="Lazio",
                country="Italia",
            )
        )

    geocoder = PhotonGeocoder("https://photon.test")
    geocoder._fetch = fake_fetch  # type: ignore[method-assign]

    result = await geocoder.geocode("Via Roma 1, Roma")

    assert isinstance(result, GeocodedAddress)
    assert result.normalized_key == "via roma 1, roma"
    assert result.latitude == pytest.approx(41.8933)
    assert result.longitude == pytest.approx(12.4829)
    assert result.geohash
    assert "1 Via Roma" in result.display_address
    assert "Roma" in result.display_address


@pytest.mark.asyncio
async def test_photon_geocoder_geocode_caches_results() -> None:
    calls = {"count": 0}

    async def fake_fetch(params):
        calls["count"] += 1
        return _photon_response(_photon_feature(12.4829, 41.8933, name="Via Roma"))

    geocoder = PhotonGeocoder("https://photon.test")
    geocoder._fetch = fake_fetch  # type: ignore[method-assign]

    first = await geocoder.geocode("Via Roma 1, Roma")
    second = await geocoder.geocode("Via Roma 1, Roma")
    assert first == second
    assert calls["count"] == 1


@pytest.mark.asyncio
async def test_photon_geocoder_geocode_returns_none_without_features() -> None:
    async def fake_fetch(params):
        return _photon_response()

    geocoder = PhotonGeocoder("https://photon.test")
    geocoder._fetch = fake_fetch  # type: ignore[method-assign]

    assert await geocoder.geocode("Via Inesistente 99, Nowhere") is None


@pytest.mark.asyncio
async def test_photon_geocoder_reverse_parses_nearest_feature() -> None:
    async def fake_reverse_fetch(params):
        return _photon_response(
            _photon_feature(12.4823, 41.8957, name="Piazza Venezia", city="Roma")
        )

    geocoder = PhotonGeocoder("https://photon.test")
    geocoder._reverse_fetch = fake_reverse_fetch  # type: ignore[method-assign]

    result = await geocoder.reverse(41.8957, 12.4823)

    assert result is not None
    assert "Piazza Venezia" in result.display_address
    assert result.latitude == pytest.approx(41.8957)
    assert result.longitude == pytest.approx(12.4823)


@pytest.mark.asyncio
async def test_photon_geocoder_reverse_returns_none_without_features() -> None:
    async def fake_reverse_fetch(params):
        return _photon_response()

    geocoder = PhotonGeocoder("https://photon.test")
    geocoder._reverse_fetch = fake_reverse_fetch  # type: ignore[method-assign]

    assert await geocoder.reverse(0.0, 0.0) is None


@pytest.mark.asyncio
async def test_photon_geocoder_reverse_hits_the_reverse_endpoint() -> None:
    """Reverse geocoding must call ``/reverse``, not the forward ``/api``:
    browser-location autofill against photon.komoot.io silently failed in
    production because ``/api`` with lat/lon returns nothing (plan todo)."""
    import httpx

    captured: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(str(request.url))
        return httpx.Response(
            200,
            json={
                "features": [
                    {
                        "geometry": {"type": "Point", "coordinates": [12.4823, 41.8957]},
                        "properties": {"name": "Piazza Venezia", "city": "Roma"},
                    }
                ]
            },
        )

    transport = httpx.MockTransport(handler)
    geocoder = PhotonGeocoder("https://photon.test")
    geocoder._client = httpx.AsyncClient(base_url="https://photon.test", transport=transport)

    result = await geocoder.reverse(41.8957, 12.4823)

    assert result is not None
    assert "Piazza Venezia" in result.display_address
    assert captured == ["https://photon.test/reverse?lat=41.8957&lon=12.4823&limit=1"]


@pytest.mark.asyncio
async def test_photon_geocoder_geocode_degrades_on_429() -> None:
    import httpx

    async def fake_fetch(params):
        return httpx.Response(429, request=httpx.Request("GET", "http://x"))

    geocoder = PhotonGeocoder("https://photon.test")
    geocoder._fetch = fake_fetch  # type: ignore[method-assign]

    assert await geocoder.geocode("via roma") is None


@pytest.mark.asyncio
async def test_photon_geocoder_geocode_raises_on_non_429() -> None:
    import httpx

    async def fake_fetch(params):
        return httpx.Response(500, request=httpx.Request("GET", "http://x"))

    geocoder = PhotonGeocoder("https://photon.test")
    geocoder._fetch = fake_fetch  # type: ignore[method-assign]

    with pytest.raises(httpx.HTTPStatusError):
        await geocoder.geocode("via roma")


@pytest.mark.asyncio
async def test_photon_geocoder_suggest_forwards_query_and_limit() -> None:
    captured: dict[str, str] = {}

    async def fake_fetch(params):
        captured.update(params)
        return _photon_response(
            _photon_feature(12.4829, 41.8933, name="Via Roma", city="Roma"),
            _photon_feature(9.2, 45.4861, name="Via Roma", city="Milano"),
        )

    geocoder = PhotonGeocoder("https://photon.test")
    geocoder._fetch = fake_fetch  # type: ignore[method-assign]

    suggestions = await geocoder.suggest("via roma", limit=2)

    assert suggestions == ["Via Roma, Roma", "Via Roma, Milano"]
    assert captured["q"] == "via roma"
    assert captured["limit"] == "2"


@pytest.mark.asyncio
async def test_photon_geocoder_suggest_caches_by_query() -> None:
    """Repeated lookups must not hammer the upstream API (429 prevention)."""
    calls: list[dict[str, str]] = []

    async def fake_fetch(params):
        calls.append(params)
        return _photon_response(_photon_feature(12.4829, 41.8933, name="Via Roma"))

    geocoder = PhotonGeocoder("https://photon.test")
    geocoder._fetch = fake_fetch  # type: ignore[method-assign]

    first = await geocoder.suggest("via roma")
    second = await geocoder.suggest("via roma")
    third = await geocoder.suggest("via roma")

    assert first == second == third
    assert len(calls) == 1, "suggest must hit the upstream API only once"


@pytest.mark.asyncio
async def test_photon_geocoder_suggest_degrades_on_429() -> None:
    import httpx

    async def fake_fetch(params):
        return httpx.Response(429, request=httpx.Request("GET", "http://x"))

    geocoder = PhotonGeocoder("https://photon.test")
    geocoder._fetch = fake_fetch  # type: ignore[method-assign]

    assert await geocoder.suggest("via roma") == []


def test_photon_geocoder_display_name_uses_housenumber_and_street() -> None:
    display = PhotonGeocoder._display_name(
        "via roma 1",
        {"housenumber": "1", "street": "Via Roma", "city": "Roma", "country": "Italia"},
    )
    assert display == "1 Via Roma, Roma, Italia"


def test_photon_geocoder_display_name_avoids_city_duplication() -> None:
    display = PhotonGeocoder._display_name(
        "roma",
        {"name": "Roma", "city": "Roma", "state": "Lazio", "country": "Italia"},
    )
    assert display == "Roma, Lazio, Italia"


def test_build_geocoder_returns_photon_for_photon_mode() -> None:
    geocoder = build_geocoder("photon", "https://photon.komoot.io", 86400)
    assert isinstance(geocoder, PhotonGeocoder)
