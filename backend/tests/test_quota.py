"""Daily posting quota (ADR 0022).

The trust ladder now gates *how much an unknown device can write*, not how far
its posts travel: ``UNTRUSTED_DAILY_POSTS = 3``, ``TRUSTED_DAILY_POSTS = 30``.
The quota counts the device's posts in the current UTC day and is surfaced
transparently on ``/api/me`` and the create-post response.
"""

import pytest

from app.api.deps import get_post_rate_limiter
from app.main import app
from app.models.device import Device
from app.services.trust import (
    TRUSTED_DAILY_POSTS,
    UNTRUSTED_DAILY_POSTS,
    daily_post_quota,
)


async def _post(client, body: str = "ciao") -> None:
    response = await client.post(
        "/api/posts", json={"address": "Via Roma 1, Roma", "body": body}
    )
    assert response.status_code == 201


async def _age_device(session_factory, device_id: str, days: int) -> None:
    """Backdate the device so the trust ladder considers it trusted."""
    from datetime import UTC, datetime, timedelta

    from sqlalchemy import text

    async with session_factory() as session:
        await session.execute(
            text("UPDATE devices SET created_at = :older WHERE id = :did"),
            {"older": datetime.now(UTC) - timedelta(days=days), "did": device_id},
        )
        await session.commit()


@pytest.mark.asyncio
async def test_daily_post_quota_returns_3_for_new_and_30_for_trusted(client) -> None:
    response = await client.get("/api/me")
    assert response.status_code == 200
    assert response.json()["daily_post_limit"] == UNTRUSTED_DAILY_POSTS == 3
    assert response.json()["posts_left_today"] == UNTRUSTED_DAILY_POSTS


@pytest.mark.asyncio
async def test_daily_post_quota_drops_after_each_post(client, session_factory) -> None:
    await client.get("/api/me")  # mint the device
    await _post(client, "uno")
    me = await client.get("/api/me")
    assert me.json()["posts_left_today"] == UNTRUSTED_DAILY_POSTS - 1


@pytest.mark.asyncio
async def test_untrusted_device_blocked_after_three_posts(client, session_factory) -> None:
    await client.get("/api/me")
    for i in range(UNTRUSTED_DAILY_POSTS):
        await _post(client, f"post {i}")
    # Fourth post is rejected.
    response = await client.post(
        "/api/posts", json={"address": "Via Roma 1, Roma", "body": "troppo"}
    )
    assert response.status_code == 429
    assert response.json()["detail"]["code"] == "daily_quota_exceeded"
    assert response.json()["detail"]["posts_left_today"] == 0


@pytest.mark.asyncio
async def test_trusted_device_allowed_thirty_posts(client, session_factory) -> None:
    # The per-minute API abuse limiter (default 5/min) is orthogonal to the
    # daily trust quota; disable it so this test exercises the quota alone.
    app.dependency_overrides[get_post_rate_limiter] = lambda: None
    try:
        await client.get("/api/me")
        me = await client.get("/api/me")
        device_id = me.json()["id"]
        await _age_device(session_factory, device_id, days=8)

        for i in range(TRUSTED_DAILY_POSTS):
            await _post(client, f"post {i}")
        # 31st post is rejected.
        response = await client.post(
            "/api/posts", json={"address": "Via Roma 1, Roma", "body": "troppo"}
        )
        assert response.status_code == 429
        assert response.json()["detail"]["code"] == "daily_quota_exceeded"
        assert response.json()["detail"]["posts_left_today"] == 0
    finally:
        app.dependency_overrides.pop(get_post_rate_limiter, None)


@pytest.mark.asyncio
async def test_post_response_exposes_posts_left_today(client) -> None:
    await client.get("/api/me")
    response = await client.post(
        "/api/posts", json={"address": "Via Roma 1, Roma", "body": "ciao"}
    )
    assert response.status_code == 201
    assert response.json()["posts_left_today"] == UNTRUSTED_DAILY_POSTS - 1


@pytest.mark.asyncio
async def test_daily_post_quota_uses_device_age(client, session_factory) -> None:
    """The quota is a pure function of trust (device age), not a fixed constant."""
    await client.get("/api/me")
    me = await client.get("/api/me")
    device_id = me.json()["id"]
    await _age_device(session_factory, device_id, days=8)

    async with session_factory() as session:
        device = await session.get(Device, device_id)
        assert daily_post_quota(device) == TRUSTED_DAILY_POSTS
        assert daily_post_quota(device) == 30