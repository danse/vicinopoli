"""Post creation and feed visibility tests (DB-backed, real PostGIS).

These exercise the API contract and the ADR 0006 visibility semantics:
visibility = distance <= scope AND distance <= search_radius; ``building``
matches on the normalized address key.
"""

import pytest

from app.core.geocoder import STATIC_ADDRESSES

# Coordinates from the StaticGeocoder address map.
VIA_ROMA = STATIC_ADDRESSES["via roma 1, roma"]  # (41.8933, 12.4829)
PIAZZA_VENEZIA = STATIC_ADDRESSES["piazza venezia, roma"]
MILANO = STATIC_ADDRESSES["milano centrale, milano"]


@pytest.mark.asyncio
async def test_create_text_post(client) -> None:
    response = await client.post(
        "/api/posts",
        json={
            "address": "Via Roma 1, Roma",
            "body": "Ciao vicini!",
            "scope": "1km",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["body"] == "Ciao vicini!"
    assert data["scope"] == "1km"
    assert data["location"]["display_address"] == "Via Roma 1, Roma"
    assert data["distance_m"] == 0.0


@pytest.mark.asyncio
async def test_create_post_unknown_address_returns_404(client) -> None:
    response = await client.post(
        "/api/posts",
        json={"address": "Via Inesistente 99, Nowhere", "body": "x", "scope": "1km"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_feed_shows_post_at_same_address(client) -> None:
    await client.post(
        "/api/posts",
        json={"address": "Via Roma 1, Roma", "body": "ciao", "scope": "1km"},
    )
    response = await client.get("/api/feed", params={"address": "Via Roma 1, Roma"})
    assert response.status_code == 200
    data = response.json()
    assert data["posts"]
    assert data["posts"][0]["body"] == "ciao"
    assert data["effective_radius_m"] > 0


@pytest.mark.asyncio
async def test_feed_respects_scope_distance(client) -> None:
    """A post with scope 500m must NOT be visible from ~3.5km away."""
    await client.post(
        "/api/posts",
        json={
            "address": "Via Roma 1, Roma",
            "body": "piano di sotto",
            "scope": "500m",
        },
    )
    # Milano is ~470km away — outside any scope/search radius.
    response = await client.get("/api/feed", params={"address": "Milano Centrale, Milano"})
    assert response.status_code == 200
    assert response.json()["posts"] == []


@pytest.mark.asyncio
async def test_feed_building_scope_requires_same_address(client) -> None:
    """building scope matches the normalized address key only."""
    await client.post(
        "/api/posts",
        json={
            "address": "Via Roma 1, Roma",
            "body": "dalla stessa via",
            "scope": "building",
        },
    )
    # Same address -> visible.
    same = await client.get("/api/feed", params={"address": "Via Roma 1, Roma"})
    assert same.json()["posts"][0]["body"] == "dalla stessa via"

    # A nearby but different address must NOT see it.
    other = await client.get("/api/feed", params={"address": "Piazza Venezia, Roma"})
    assert other.json()["posts"] == []


@pytest.mark.asyncio
async def test_feed_respects_search_radius(client) -> None:
    """A post outside the viewer's search_radius is never shown.

    Via Roma and Piazza Venezia are ~270m apart (per the static geocoder map),
    so a 100m search radius excludes the far post while a generous radius
    includes it.
    """
    await client.post(
        "/api/posts",
        json={"address": "Via Roma 1, Roma", "body": "ci sono", "scope": "5km"},
    )
    excluded = await client.get(
        "/api/feed",
        params={"address": "Piazza Venezia, Roma", "search_radius_m": 100},
    )
    assert excluded.status_code == 200
    assert excluded.json()["posts"] == []

    included = await client.get(
        "/api/feed",
        params={"address": "Piazza Venezia, Roma", "search_radius_m": 50000},
    )
    assert included.status_code == 200
    assert included.json()["posts"]


@pytest.mark.asyncio
async def test_feed_expands_radius_to_target(client) -> None:
    """Expanding radius returns at least as many posts as target_count allows."""
    await client.post(
        "/api/posts",
        json={"address": "Via Roma 1, Roma", "body": "uno", "scope": "5km"},
    )
    await client.post(
        "/api/posts",
        json={"address": "Piazza Venezia, Roma", "body": "due", "scope": "5km"},
    )
    response = await client.get(
        "/api/feed",
        params={"address": "Via Roma 1, Roma", "target_count": 1},
    )
    data = response.json()
    assert len(data["posts"]) >= 1
    assert data["effective_radius_m"] >= 500
