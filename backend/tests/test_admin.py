"""Admin firehose tests (ADR 0021).

The firehose lists every post regardless of status, newest first, gated by the
shared admin token. Only geohash + display address are exposed, never raw
coordinates.
"""

import pytest

ADMIN_TOKEN = "test-admin-token"


async def _post(client, device: bool = True, body: str = "post admin") -> str:
    if device:
        await client.get("/api/me")
    response = await client.post(
        "/api/posts",
        json={"address": "Via Roma 1, Roma", "body": body, "scope": "1km"},
    )
    assert response.status_code == 201
    return response.json()["id"]


async def _new_device(client) -> None:
    client.cookies.clear()
    await client.get("/api/me")


def _admin_get(client, **kwargs):
    headers = {"X-Admin-Token": ADMIN_TOKEN, **kwargs.pop("headers", {})}
    return client.get("/api/admin/posts", headers=headers, **kwargs)


@pytest.mark.asyncio
async def test_admin_requires_token(client) -> None:
    response = await client.get("/api/admin/posts")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_admin_rejects_wrong_token(client) -> None:
    response = await client.get(
        "/api/admin/posts", headers={"X-Admin-Token": "wrong"}
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_admin_disabled_when_token_unset(client) -> None:
    """Fail closed: without ADMIN_TOKEN configured, 401 even with a token."""
    from app.core.config import settings

    original = settings.admin_token
    settings.admin_token = None
    try:
        response = await client.get(
            "/api/admin/posts", headers={"X-Admin-Token": ADMIN_TOKEN}
        )
        assert response.status_code == 401
    finally:
        settings.admin_token = original


@pytest.mark.asyncio
async def test_admin_lists_posts_with_report_count(client) -> None:
    post_id = await _post(client, body="post attivo")

    for _ in range(2):
        await _new_device(client)
        response = await client.post(f"/api/posts/{post_id}/report", json={})
        assert response.status_code == 201

    response = await _admin_get(client)
    assert response.status_code == 200
    body = response.json()
    posts = body["posts"]
    assert len(posts) == 1
    assert posts[0]["body"] == "post attivo"
    assert posts[0]["report_count"] == 2
    assert posts[0]["status"] == "active"
    assert posts[0]["display_address"] == "Via Roma 1, Roma"
    assert posts[0]["geohash"]


@pytest.mark.asyncio
async def test_admin_lists_auto_hidden_and_hidden_posts(client, session_factory) -> None:
    auto_hidden_id = await _post(client, body="auto nascosto")
    for _ in range(3):
        await _new_device(client)
        response = await client.post(f"/api/posts/{auto_hidden_id}/report", json={})
        assert response.status_code == 201

    hidden_id = await _post(client, body="nascosto dal moderatore")
    from sqlalchemy import update

    from app.models.post import Post, PostStatus

    async with session_factory() as session:
        await session.execute(
            update(Post).where(Post.id == hidden_id).values(status=PostStatus.hidden)
        )
        await session.commit()

    response = await _admin_get(client)
    bodies = {p["body"]: p["status"] for p in response.json()["posts"]}
    assert bodies["auto nascosto"] == "auto_hidden"
    assert bodies["nascosto dal moderatore"] == "hidden"
    assert bodies["auto nascosto"] in ("auto_hidden",)
    assert bodies["nascosto dal moderatore"] in ("hidden",)


@pytest.mark.asyncio
async def test_admin_response_has_no_coordinates(client) -> None:
    await _post(client)
    response = await _admin_get(client)
    post = response.json()["posts"][0]
    assert "latitude" not in post
    assert "longitude" not in post
    assert "point" not in post


@pytest.mark.asyncio
async def test_admin_paginates_with_cursor(client) -> None:
    for i in range(5):
        await _new_device(client)
        await client.post(
            "/api/posts",
            json={"address": "Via Roma 1, Roma", "body": f"post {i}", "scope": "1km"},
        )

    first = await _admin_get(client, params={"limit": 2})
    assert first.status_code == 200
    first_body = first.json()
    assert len(first_body["posts"]) == 2
    assert first_body["next_cursor"]

    second = await _admin_get(client, params={"limit": 2, "cursor": first_body["next_cursor"]})
    assert second.status_code == 200
    second_body = second.json()
    assert len(second_body["posts"]) == 2
    seen = {p["body"] for p in first_body["posts"]} | {p["body"] for p in second_body["posts"]}
    assert len(seen) == 4


@pytest.mark.asyncio
async def test_admin_invalid_cursor_returns_400(client) -> None:
    await _post(client)
    response = await _admin_get(client, params={"cursor": "not-a-cursor"})
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_admin_lists_posts_with_media(client) -> None:
    """Media is returned as MediaInfo (signed URLs), not raw ORM objects."""
    media = await client.post(
        "/api/media/register",
        json={
            "kind": "image",
            "object_key": "images/2026/08/abc-admin.jpg",
            "content_type": "image/jpeg",
            "size": 5120,
        },
    )
    media_id = media.json()["id"]

    await client.get("/api/me")
    response = await client.post(
        "/api/posts",
        json={
            "address": "Via Roma 1, Roma",
            "body": "",
            "scope": "1km",
            "media_ids": [media_id],
        },
    )
    assert response.status_code == 201

    feed = await _admin_get(client)
    post = feed.json()["posts"][0]
    assert post["media"]
    assert post["media"][0]["id"] == media_id
    assert post["media"][0]["url"]
    assert set(post["media"][0]) == {"id", "kind", "url", "duration_s"}
