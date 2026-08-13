"""Media upload tests (ADR 0013).

The API issues a presigned URL for direct upload to MinIO; the client then
references the object key when creating a post. The feed returns media
associated with each post.
"""

import pytest


@pytest.mark.asyncio
async def test_presign_returns_upload_url(client) -> None:
    response = await client.post(
        "/api/media/presign",
        json={
            "kind": "image",
            "content_type": "image/jpeg",
            "size": 123456,
            "filename": "foto.jpg",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["object_key"]
    assert data["url"].startswith("http")
    assert data["kind"] == "image"
    assert data["content_type"] == "image/jpeg"


@pytest.mark.asyncio
async def test_presign_rejects_unknown_kind(client) -> None:
    response = await client.post(
        "/api/media/presign",
        json={"kind": "video", "content_type": "video/mp4", "size": 1},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_presign_rejects_oversized_photo(client) -> None:
    response = await client.post(
        "/api/media/presign",
        json={"kind": "image", "content_type": "image/jpeg", "size": 50 * 1024 * 1024},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_post_with_media_returns_media_in_feed(client) -> None:
    # MinIO may not be reachable in tests; a registered media object still
    # resolves to its public URL via the media key lookup.
    media = await client.post(
        "/api/media/register",
        json={
            "kind": "image",
            "object_key": "images/2026/08/abc123.jpg",
            "content_type": "image/jpeg",
            "size": 5120,
        },
    )
    assert media.status_code == 201
    media_id = media.json()["id"]

    await client.post(
        "/api/posts",
        json={
            "address": "Via Roma 1, Roma",
            "body": "foto qui",
            "scope": "1km",
            "media_ids": [media_id],
        },
    )
    feed = await client.get("/api/feed", params={"address": "Via Roma 1, Roma"})
    item = feed.json()["posts"][0]
    assert item["media"][0]["id"] == media_id
    assert item["media"][0]["kind"] == "image"


@pytest.mark.asyncio
async def test_voice_presign_and_register_with_duration(client) -> None:
    presign = await client.post(
        "/api/media/presign",
        json={
            "kind": "voice",
            "content_type": "audio/webm",
            "size": 12345,
            "filename": "msg.webm",
        },
    )
    assert presign.status_code == 200
    assert presign.json()["kind"] == "voice"
    assert presign.json()["object_key"].startswith("voices/")

    registered = await client.post(
        "/api/media/register",
        json={
            "kind": "voice",
            "object_key": presign.json()["object_key"],
            "content_type": "audio/webm",
            "size": 12345,
            "duration_s": 4.2,
        },
    )
    assert registered.status_code == 201
    data = registered.json()
    assert data["kind"] == "voice"
    assert data["content_type"] == "audio/webm"

    await client.post(
        "/api/posts",
        json={
            "address": "Via Roma 1, Roma",
            "body": "messaggio vocale",
            "scope": "1km",
            "media_ids": [data["id"]],
        },
    )
    feed = await client.get("/api/feed", params={"address": "Via Roma 1, Roma"})
    item = feed.json()["posts"][0]
    assert item["media"][0]["kind"] == "voice"
    assert item["media"][0]["duration_s"] == 4.2
    assert item["media"][0]["url"].startswith("http")