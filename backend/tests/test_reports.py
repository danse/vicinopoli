"""Report workflow tests (ADR 0009).

Auto-hide at N distinct-device reports gives immediate relief; the feed then
excludes auto-hidden posts. Rate limiting (ADR 0005) protects post creation.
"""

import pytest


async def _post(client, device: bool = True) -> str:
    if device:
        await client.get("/api/me")
    response = await client.post(
        "/api/posts",
        json={"address": "Via Roma 1, Roma", "body": "post originale", "scope": "1km"},
    )
    assert response.status_code == 201
    return response.json()["id"]


async def _new_device(client) -> None:
    client.cookies.clear()
    await client.get("/api/me")


@pytest.mark.asyncio
async def test_report_requires_device(client) -> None:
    post_id = await _post(client)
    response = await client.post(f"/api/posts/{post_id}/report", json={})
    assert response.status_code == 201
    assert response.json()["post_id"] == post_id
    assert response.json()["status"] == "submitted"


@pytest.mark.asyncio
async def test_single_report_keeps_post_visible(client) -> None:
    post_id = await _post(client)
    await client.post(f"/api/posts/{post_id}/report", json={})

    feed = await client.get("/api/feed", params={"address": "Via Roma 1, Roma"})
    bodies = [p["body"] for p in feed.json()["posts"]]
    assert "post originale" in bodies


@pytest.mark.asyncio
async def test_auto_hide_after_threshold_distinct_devices(client) -> None:
    """After 3 distinct devices report, the post is auto-hidden from the feed."""
    post_id = await _post(client)

    for _ in range(3):
        await _new_device(client)
        response = await client.post(f"/api/posts/{post_id}/report", json={})
        assert response.status_code == 201

    feed = await client.get("/api/feed", params={"address": "Via Roma 1, Roma"})
    bodies = [p["body"] for p in feed.json()["posts"]]
    assert "post originale" not in bodies


@pytest.mark.asyncio
async def test_report_status_auto_hidden_reported(client) -> None:
    """The response of the report that crosses the threshold says auto_hidden."""
    post_id = await _post(client)
    for _ in range(2):
        await _new_device(client)
        await client.post(f"/api/posts/{post_id}/report", json={})

    await _new_device(client)
    response = await client.post(f"/api/posts/{post_id}/report", json={})
    assert response.status_code == 201
    assert response.json()["post_status"] == "auto_hidden"


@pytest.mark.asyncio
async def test_rate_limit_exceeded_returns_429(client) -> None:
    await client.get("/api/me")
    for _ in range(5):
        response = await client.post(
            "/api/posts",
            json={"address": "Via Roma 1, Roma", "body": "x", "scope": "1km"},
        )
        assert response.status_code == 201

    response = await client.post(
        "/api/posts",
        json={"address": "Via Roma 1, Roma", "body": "y", "scope": "1km"},
    )
    assert response.status_code == 429
