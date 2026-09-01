"""Post creation and feed visibility tests (DB-backed, real PostGIS).

These exercise the API contract and the adaptive-feed visibility semantics
(glossary: reach, ADR 0024): visibility = distance <= reach(voice), where
reach comes from the stored ``voice`` via ``VOICE_TO_REACH_M`` (street->5m,
some->500m, area->3km, city->50km). ``street`` is a 5m radius; the legacy
normalized-address-key gate is gone.
"""

import pytest

from app.core.geocoder import STATIC_ADDRESSES

# Coordinates from the StaticGeocoder address map.
VIA_ROMA = STATIC_ADDRESSES["via roma 1, roma"]  # (41.8933, 12.4829)
PIAZZA_VENEZIA = STATIC_ADDRESSES["piazza venezia, roma"]
MILANO = STATIC_ADDRESSES["milano centrale, milano"]


async def _create_post(
    client,
    body: str,
    address: str = "Via Roma 1, Roma",
    scope: str = "5km",
) -> dict:
    """Create a post, failing loudly if it is not accepted.

    Post creation is rate-limited per device (ADR 0005); a test that depends on
    a batch of posts must override the limiter, otherwise only the first few
    succeed and the rest are silently dropped.
    """
    response = await client.post(
        "/api/posts",
        json={"address": address, "body": body, "scope": scope},
    )
    assert response.status_code == 201, (
        f"post '{body}' rejected with {response.status_code}: {response.text}"
    )
    return response.json()


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
    # Legacy 1km scope maps onto the voice model as ``some``; the trust cap
    # now gates a neighbour count, not a distance (ADR 0005).
    assert data["voice"] == "some"
    assert data["location"]["display_address"] == "Via Roma 1, Roma"
    assert data["distance_m"] == 0.0
    assert data["new_neighbour"] is True


@pytest.mark.asyncio
async def test_create_post_unknown_address_returns_404(client) -> None:
    response = await client.post(
        "/api/posts",
        json={"address": "Via Inesistente 99, Nowhere", "body": "x", "scope": "1km"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_post_without_body_or_media_rejected(client) -> None:
    """Text is opt-in only when media is present: an empty body with no media
    is still rejected."""
    response = await client.post(
        "/api/posts",
        json={"address": "Via Roma 1, Roma", "body": "", "scope": "1km"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_post_with_media_and_no_body(client) -> None:
    """A photo or voice post can skip the text entirely (plan: 'text is
    opt-in when entering a picture')."""
    media = await client.post(
        "/api/media/register",
        json={
            "kind": "image",
            "object_key": "images/2026/08/abc-no-text.jpg",
            "content_type": "image/jpeg",
            "size": 5120,
        },
    )
    media_id = media.json()["id"]

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
    data = response.json()
    assert data["body"] == ""
    assert data["media"][0]["id"] == media_id

    feed = await client.get("/api/feed", params={"address": "Via Roma 1, Roma"})
    item = feed.json()["posts"][0]
    assert item["body"] == ""
    assert item["media"][0]["kind"] == "image"


@pytest.mark.asyncio
async def test_create_post_degrades_when_geocoder_rate_limited(client) -> None:
    """A Nominatim 429 on geocode must not become a 500 when posting.

    Reproduces the production 500: the upsteam rate limit is treated as an
    unknown address so the client can show a recoverable error, not a crash.
    """

    import httpx

    from app.api.deps import get_geocoder
    from app.core.geocoder import NominatimGeocoder
    from app.main import app

    async def fake_fetch(params):
        return httpx.Response(429, request=httpx.Request("GET", "http://x"))

    geocoder = NominatimGeocoder("https://nominatim.test")
    geocoder._fetch = fake_fetch  # type: ignore[method-assign]
    app.dependency_overrides[get_geocoder] = lambda: geocoder

    try:
        response = await client.post(
            "/api/posts",
            json={"address": "Via Roma 1, Roma", "body": "x", "scope": "1km"},
        )
    finally:
        del app.dependency_overrides[get_geocoder]

    # Not a 500/201; degrade the same way as an unknown address.
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
async def test_feed_is_newest_first(client, session_factory) -> None:
    """The feed is reverse-chronological: newest posts come first.

    ``created_at`` is a server default, so the two posts are backdated in the
    DB to force a deterministic order regardless of execution speed.
    """
    await client.post(
        "/api/posts",
        json={"address": "Via Roma 1, Roma", "body": "più vecchio", "scope": "5km"},
    )
    await client.post(
        "/api/posts",
        json={"address": "Via Roma 1, Roma", "body": "più nuovo", "scope": "5km"},
    )

    from datetime import UTC, datetime, timedelta

    from sqlalchemy import text

    async with session_factory() as session:
        await session.execute(
            text(
                "UPDATE posts SET created_at = :older "
                "WHERE body = 'più vecchio'"
            ),
            {"older": datetime.now(UTC) - timedelta(hours=1)},
        )
        await session.commit()

    response = await client.get("/api/feed", params={"address": "Via Roma 1, Roma"})
    assert response.status_code == 200
    bodies = [post["body"] for post in response.json()["posts"]]
    assert bodies == ["più nuovo", "più vecchio"]


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
async def test_feed_street_scope_requires_same_address(client) -> None:
    """street scope matches the normalized address key only."""
    await client.post(
        "/api/posts",
        json={
            "address": "Via Roma 1, Roma",
            "body": "dalla stessa via",
            "scope": "street",
        },
    )
    # Same address -> visible.
    same = await client.get("/api/feed", params={"address": "Via Roma 1, Roma"})
    assert same.json()["posts"][0]["body"] == "dalla stessa via"

    # A nearby but different address must NOT see it.
    other = await client.get("/api/feed", params={"address": "Piazza Venezia, Roma"})
    assert other.json()["posts"] == []


@pytest.mark.asyncio
async def test_feed_expands_radius_for_distinct_posters(client) -> None:
    """The radius widens until it covers MIN_POSTERS distinct posters, not
    just ``target_count`` posts: two posts by one author do not stop the walk,
    so the feed reaches the 50km ceiling in a sparse area."""
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
        params={"address": "Via Roma 1, Roma"},
    )
    data = response.json()
    assert data["effective_radius_m"] == 50000  # ceiling: only 1 distinct poster
    assert {post["body"] for post in data["posts"]} == {"uno", "due"}


@pytest.mark.asyncio
async def test_feed_widens_for_distinct_posters_not_post_count(
    client, monkeypatch
) -> None:
    """Widening is driven by distinct posters: a single author's 3 posts do not
    stop the walk, even though they fill the page's post count."""
    monkeypatch.setattr("app.services.feed.MIN_POSTERS", 2)
    client.cookies.clear()
    for body in ("uno", "due", "tre"):
        await _create_post(client, body)  # same device, 3 posts
    data = (
        await client.get(
            "/api/feed", params={"address": "Via Roma 1, Roma", "target_count": 3}
        )
    ).json()
    assert data["effective_radius_m"] == 50000  # 1 distinct poster < MIN_POSTERS


@pytest.mark.asyncio
async def test_feed_stops_when_min_posters_covered(client, monkeypatch) -> None:
    """Once MIN_POSTERS distinct posters are within reach, the walk stops."""
    monkeypatch.setattr("app.services.feed.MIN_POSTERS", 2)
    client.cookies.clear()
    await _create_post(client, "A1")
    await _create_post(client, "A2")  # same device as A1
    client.cookies.clear()
    await _create_post(client, "B1")  # second device
    data = (
        await client.get("/api/feed", params={"address": "Via Roma 1, Roma"})
    ).json()
    assert data["effective_radius_m"] == 5  # 2 distinct posters within 5m


@pytest.mark.asyncio
async def test_feed_keeps_scope_when_seeded(client, monkeypatch) -> None:
    """``radius_m`` seeds the ladder so a later page never restarts below the
    established scope (which would shrink "Entro <x>" mid-pagination)."""
    monkeypatch.setattr("app.services.feed.MIN_POSTERS", 1)
    for body in ("uno", "due", "tre"):
        client.cookies.clear()
        await _create_post(client, body)
    page1 = (
        await client.get(
            "/api/feed", params={"address": "Via Roma 1, Roma", "target_count": 2}
        )
    ).json()
    assert page1["effective_radius_m"] == 5
    cursor = page1["next_cursor"]
    assert cursor is not None

    seeded = (
        await client.get(
            "/api/feed",
            params={
                "address": "Via Roma 1, Roma",
                "cursor": cursor,
                "target_count": 2,
                "radius_m": "50km",
            },
        )
    ).json()
    assert seeded["effective_radius_m"] == 50000  # starts at 50km, not 5m

    unseeded = (
        await client.get(
            "/api/feed",
            params={"address": "Via Roma 1, Roma", "cursor": cursor, "target_count": 2},
        )
    ).json()
    assert unseeded["effective_radius_m"] == 5  # without the seed it restarts at 5m


@pytest.mark.asyncio
async def test_feed_rejects_invalid_radius_m(client) -> None:
    """A ``radius_m`` outside the known scope steps is rejected with 422."""
    response = await client.get(
        "/api/feed",
        params={"address": "Via Roma 1, Roma", "radius_m": "1km"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_feed_paginates_with_cursor(client) -> None:
    """Keyset pagination: each page carries a next_cursor that resumes strictly
    after the previous page, without overlap, until posts are exhausted.

    Each post is created by a fresh device (cookie cleared) so the per-device
    post rate limit (ADR 0005) stays enabled and can't silently drop posts.
    """
    for i in range(25):
        client.cookies.clear()
        await _create_post(client, f"post-{i:02d}")

    first = await client.get(
        "/api/feed",
        params={"address": "Via Roma 1, Roma", "target_count": 10},
    )
    assert first.status_code == 200
    page1 = first.json()
    assert len(page1["posts"]) == 10
    assert page1["next_cursor"] is not None
    page1_ids = {post["id"] for post in page1["posts"]}

    second = await client.get(
        "/api/feed",
        params={
            "address": "Via Roma 1, Roma",
            "target_count": 10,
            "cursor": page1["next_cursor"],
        },
    )
    page2 = second.json()
    assert len(page2["posts"]) == 10
    assert page2["next_cursor"] is not None
    page2_ids = {post["id"] for post in page2["posts"]}
    assert page1_ids.isdisjoint(page2_ids)

    third = await client.get(
        "/api/feed",
        params={
            "address": "Via Roma 1, Roma",
            "target_count": 10,
            "cursor": page2["next_cursor"],
        },
    )
    page3 = third.json()
    assert len(page3["posts"]) == 5
    assert page3["next_cursor"] is None
    page3_ids = {post["id"] for post in page3["posts"]}
    assert page1_ids.isdisjoint(page3_ids)
    assert page2_ids.isdisjoint(page3_ids)

    all_posts = page1_ids | page2_ids | page3_ids
    assert len(all_posts) == 25


@pytest.mark.asyncio
async def test_feed_single_page_has_no_next_cursor(client) -> None:
    """Fewer posts than target_count means there is no next page."""
    await client.post(
        "/api/posts",
        json={"address": "Via Roma 1, Roma", "body": "solo", "scope": "5km"},
    )
    response = await client.get(
        "/api/feed",
        params={"address": "Via Roma 1, Roma", "target_count": 10},
    )
    data = response.json()
    assert len(data["posts"]) == 1
    assert data["next_cursor"] is None


@pytest.mark.asyncio
async def test_feed_invalid_cursor_returns_400(client) -> None:
    """A malformed cursor is rejected cleanly instead of 500ing."""
    response = await client.get(
        "/api/feed",
        params={"address": "Via Roma 1, Roma", "cursor": "not-a-valid-cursor"},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_feed_counts_distinct_posters_across_the_whole_radius(
    client, monkeypatch
) -> None:
    """The distinct-poster count spans *all* posts in the radius, not just the
    newest ``target_count``: even when the newest page-slot posts come from one
    author, a radius that also contains another author's posts is not widened."""
    monkeypatch.setattr("app.services.feed.MIN_POSTERS", 2)
    client.cookies.clear()
    await _create_post(client, "A1")
    client.cookies.clear()
    await _create_post(client, "B1")

    response = await client.get(
        "/api/feed",
        params={"address": "Via Roma 1, Roma", "target_count": 1},
    )
    assert response.status_code == 200
    assert response.json()["effective_radius_m"] == 5
