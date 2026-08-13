"""Device identity, pseudonym, and trust ladder tests (ADR 0005).

The anonymous device token is an httpOnly cookie set lazily on first contact
with the API. Pseudonyms are optional and stored on the device. New devices
post with reduced reach until they accrue trust.
"""

import pytest


async def _get_device(client) -> str:
    """Create/fetch a device and return its cookie value."""
    response = await client.get("/api/me")
    assert response.status_code == 200
    return response.cookies.get("device_id")


@pytest.mark.asyncio
async def test_me_creates_device_and_sets_cookie(client) -> None:
    response = await client.get("/api/me")
    assert response.status_code == 200
    data = response.json()
    assert data["pseudonym"] is None
    assert data["new_neighbour"] is True
    assert "device_id" in response.cookies
    assert len(response.cookies["device_id"]) > 0


@pytest.mark.asyncio
async def test_me_returns_same_device_on_revisit(client) -> None:
    first = await _get_device(client)
    response = await client.get("/api/me")
    assert response.json()["id"] == first
    assert response.json()["pseudonym"] is None


@pytest.mark.asyncio
async def test_me_sets_pseudonym(client) -> None:
    await _get_device(client)
    response = await client.patch("/api/me", json={"pseudonym": "Gino"})
    assert response.status_code == 200
    assert response.json()["pseudonym"] == "Gino"


@pytest.mark.asyncio
async def test_post_carries_author_pseudonym_in_feed(client) -> None:
    await _get_device(client)
    await client.patch("/api/me", json={"pseudonym": "Gino"})
    await client.post(
        "/api/posts",
        json={"address": "Via Roma 1, Roma", "body": "ciao", "scope": "1km"},
    )
    feed = await client.get("/api/feed", params={"address": "Via Roma 1, Roma"})
    item = feed.json()["posts"][0]
    assert item["pseudonym"] == "Gino"
    assert item["new_neighbour"] is True


@pytest.mark.asyncio
async def test_new_device_post_scope_is_capped(client) -> None:
    """ADR 0005: new devices post with the smallest reach until trusted."""
    await _get_device(client)
    response = await client.post(
        "/api/posts",
        json={"address": "Via Roma 1, Roma", "body": "piano di sotto", "scope": "5km"},
    )
    assert response.status_code == 201
    assert response.json()["scope"] == "500m"
    assert response.json()["new_neighbour"] is True
