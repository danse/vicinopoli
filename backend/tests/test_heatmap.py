"""Heatmap + coarse geocode tests (ADR 0008).

Endpoints return density-only aggregates; the exact coordinates and post bodies
never appear in the heatmap payload.
"""

import math

import pytest

from app.core.geocoder import STATIC_ADDRESSES

VIA_ROMA = STATIC_ADDRESSES["via roma 1, roma"]  # (41.8933, 12.4829)
MILANO = STATIC_ADDRESSES["milano centrale, milano"]


def slippy_tile(lat: float, lon: float, z: int) -> tuple[int, int]:
    n = 2**z
    x = int((lon + 180.0) / 360.0 * n)
    lat_rad = math.radians(lat)
    mercator = math.log(math.tan(lat_rad) + 1 / math.cos(lat_rad)) / math.pi
    y = int((1.0 - mercator) / 2.0 * n)
    return x, y


@pytest.mark.asyncio
async def test_geocode_returns_coarse_cell(client) -> None:
    response = await client.get("/api/geocode", params={"address": "Via Roma 1, Roma"})
    assert response.status_code == 200
    data = response.json()
    assert data["display_address"] == "Via Roma 1, Roma"
    assert len(data["cell"]) == 6
    # The returned centre must be a *cell* centre, not the exact coordinates.
    lat, lon = VIA_ROMA[0], VIA_ROMA[1]
    assert data["cell_center_latitude"] != lat
    assert data["cell_center_longitude"] != lon


@pytest.mark.asyncio
async def test_geocode_returns_404_for_unknown(client) -> None:
    response = await client.get("/api/geocode", params={"address": "Nowhere 404"})
    assert response.status_code == 404


async def _post_at(client: object, address: str, body: str) -> None:
    response = await client.post(
        "/api/posts",
        json={"address": address, "body": body, "scope": "5km"},
    )
    assert response.status_code == 201


@pytest.mark.asyncio
async def test_heatmap_tile_exposes_density_not_posts(client) -> None:
    await _post_at(client, "Via Roma 1, Roma", "posta in zona palese")
    x, y = slippy_tile(VIA_ROMA[0], VIA_ROMA[1], 12)
    response = await client.get(f"/api/heatmap/12/{x}/{y}")
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert data["features"], "expected at least one density cell"
    total = sum(f["properties"]["count"] for f in data["features"])
    assert total >= 1
    serialized = str(data)
    assert "posta in zona palese" not in serialized


@pytest.mark.asyncio
async def test_heatmap_tile_empty_area(client) -> None:
    x, y = slippy_tile(MILANO[0], MILANO[1], 12)
    response = await client.get(f"/api/heatmap/12/{x}/{y}")
    assert response.status_code == 200
    assert response.json()["features"] == []


@pytest.mark.asyncio
async def test_heatmap_tile_rejects_out_of_range(client) -> None:
    assert (await client.get("/api/heatmap/25/0/0")).status_code == 422
    assert (await client.get("/api/heatmap/3/99/0")).status_code == 422
    assert (await client.get("/api/heatmap/0/0/0")).status_code == 200


@pytest.mark.asyncio
async def test_reported_post_is_removed_from_density(client) -> None:
    """The auto-hide workflow must decrement the activity cell (ADR 0009)."""
    await _post_at(client, "Via Roma 1, Roma", "spam da segnalare")
    x, y = slippy_tile(VIA_ROMA[0], VIA_ROMA[1], 12)
    before = await client.get(f"/api/heatmap/12/{x}/{y}")
    count_before = sum(f["properties"]["count"] for f in before.json()["features"])

    # Re-fetch the post id from the feed (same client), then report 3 times
    # as distinct devices to cross the auto-hide threshold.
    feed = await client.get("/api/feed", params={"address": "Via Roma 1, Roma"})
    post_id = next(p["id"] for p in feed.json()["posts"] if p["body"] == "spam da segnalare")

    for _ in range(3):
        client.cookies.clear()
        await client.get("/api/me")
        response = await client.post(f"/api/posts/{post_id}/report", json={})
        assert response.status_code == 201

    after = await client.get(f"/api/heatmap/12/{x}/{y}")
    count_after = sum(f["properties"]["count"] for f in after.json()["features"])
    assert count_after == count_before - 1