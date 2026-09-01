"""Reach conversion and adaptive-feed tests.

``reach`` is the distance a post travels, derived in the feed from the stored
``voice`` via the fixed mapping ``VOICE_TO_REACH_M`` (street->5m, some->500m,
area->3km, city->50km). Nothing is frozen on the post at publish time; the
conversion happens at feed-serve time (glossary: reach; ADR 0024). The feed's
*scope* is how far it searched: it walks ``SCOPE_STEPS`` (5m -> 500m -> 3km ->
50km), collecting posts within each step and keeping those whose ``reach``
covers the viewer, until ``target_count`` posts are gathered or the 50km
ceiling is reached.

The static geocoder map provides addresses at several distances (Piazza
Venezia ~270m from Via Roma 1, Milano ~470km away, Capracotta/Campobasso in
Molise ~45km apart).
"""

import pytest

from app.core.geocoder import STATIC_ADDRESSES
from app.services.feed import MAX_SCOPE_M, SCOPE_STEPS
from app.services.reach import VOICE_TO_REACH_M

VIA_ROMA = STATIC_ADDRESSES["via roma 1, roma"]  # (41.8933, 12.4829)
PIAZZA_VENEZIA = STATIC_ADDRESSES["piazza venezia, roma"]
MILANO = STATIC_ADDRESSES["milano centrale, milano"]
CAPRACOTTA = STATIC_ADDRESSES["capracotta, molise"]
CAMPOBASSO = STATIC_ADDRESSES["campobasso, molise"]


async def _post_at(
    client, address: str, body: str = "ciao", voice: str = "city", fresh_device: bool = True
) -> str:
    """Create a post and return the author's device cookie value.

    By default each call clears the cookie jar so it mints a fresh device
    (a distinct neighbour). Pass ``fresh_device=False`` to reuse the current
    device.
    """
    if fresh_device:
        client.cookies.clear()
    response = await client.post(
        "/api/posts",
        json={"address": address, "body": body, "voice": voice},
    )
    assert response.status_code == 201
    return response.cookies.get("device_id")


def test_voice_to_reach_mapping() -> None:
    """Every voice maps to a fixed, honest distance."""
    assert VOICE_TO_REACH_M["street"] == 5
    assert VOICE_TO_REACH_M["some"] == 500
    assert VOICE_TO_REACH_M["area"] == 3_000
    assert VOICE_TO_REACH_M["city"] == 50_000


def test_scope_steps_walk_voice_distances() -> None:
    """The adaptive-feed ladder is exactly the sorted voice reaches."""
    assert SCOPE_STEPS == (5, 500, 3_000, 50_000)
    assert MAX_SCOPE_M == 50_000


@pytest.mark.asyncio
async def test_adaptive_feed_uses_stored_voice_reach(client) -> None:
    """Visibility is distance <= reach(voice), converted at feed time.

    A ``some`` post (500m reach) at Via Roma is visible from Piazza Venezia
    (~270m); a ``street`` post (5m reach) at the same spot is NOT visible from
    there.
    """
    await _post_at(client, "Via Roma 1, Roma", body="some ciao", voice="some")
    client.cookies.clear()
    await _post_at(client, "Via Roma 1, Roma", body="street ciao", voice="street")

    feed = await client.get("/api/feed", params={"address": "Piazza Venezia, Roma"})
    assert feed.status_code == 200
    bodies = [post["body"] for post in feed.json()["posts"]]
    assert "some ciao" in bodies
    assert "street ciao" not in bodies


@pytest.mark.asyncio
async def test_adaptive_feed_effective_radius_is_the_fill_step(
    client, monkeypatch
) -> None:
    """``effective_radius_m`` is the ladder step where the distinct-poster
    fill target was met (or the 50km ceiling in sparse areas)."""
    await _post_at(client, "Via Roma 1, Roma", body="sotto casa", voice="street")

    # With the poster threshold met at 5m, the feed stops at the 5m step.
    monkeypatch.setattr("app.services.feed.MIN_POSTERS", 1)
    same = await client.get("/api/feed", params={"address": "Via Roma 1, Roma"})
    assert same.json()["effective_radius_m"] == 5

    # A single author cannot fill the real threshold: the feed reaches the
    # 50km ceiling but still returns the post.
    monkeypatch.setattr("app.services.feed.MIN_POSTERS", 10)
    sparse = await client.get("/api/feed", params={"address": "Via Roma 1, Roma"})
    assert sparse.json()["effective_radius_m"] == 50000
    assert [post["body"] for post in sparse.json()["posts"]] == ["sotto casa"]


@pytest.mark.asyncio
async def test_adaptive_feed_sparse_area_fills_at_ceiling(client) -> None:
    """Cold bootstrap in a rural area: two new users ~45km apart reach each other.

    Capracotta and Campobasso (Molise) are ~45km apart. Both posts use the
    default ``city`` voice (50km reach), so each user sees the other's post and
    the feed fills only at the 50km ceiling.
    """
    await _post_at(client, "Capracotta, Molise", body="capracotta ciao")
    await _post_at(client, "Campobasso, Molise", body="campobasso ciao")

    from_capracotta = await client.get(
        "/api/feed", params={"address": "Capracotta, Molise"}
    )
    assert from_capracotta.status_code == 200
    capracotta_bodies = [post["body"] for post in from_capracotta.json()["posts"]]
    assert "campobasso ciao" in capracotta_bodies
    assert "capracotta ciao" in capracotta_bodies
    assert from_capracotta.json()["effective_radius_m"] == MAX_SCOPE_M

    from_campobasso = await client.get(
        "/api/feed", params={"address": "Campobasso, Molise"}
    )
    assert from_campobasso.status_code == 200
    campobasso_bodies = [post["body"] for post in from_campobasso.json()["posts"]]
    assert "capracotta ciao" in campobasso_bodies
    assert "campobasso ciao" in campobasso_bodies


@pytest.mark.asyncio
async def test_new_neighbours_with_closer_third_poster_still_read_each_other(client) -> None:
    """Regression for the production Ragusa case (ADR 0022).

    Two brand-new neighbours ~45km apart still see each other even when a third
    poster sits right next to one of them. Reach comes from the fixed voice
    mapping (``city`` = 50km), independent of local density, so the extra
    poster does not collapse either post's reach.
    """
    await _post_at(client, "Capracotta, Molise", body="capracotta ciao")
    await _post_at(client, "Capracotta, Molise", body="closer ciao")  # 3rd poster, same street
    await _post_at(client, "Campobasso, Molise", body="campobasso ciao")

    from_capracotta = await client.get(
        "/api/feed", params={"address": "Capracotta, Molise"}
    )
    assert from_capracotta.status_code == 200
    capracotta_bodies = [post["body"] for post in from_capracotta.json()["posts"]]
    assert "campobasso ciao" in capracotta_bodies
    assert "closer ciao" in capracotta_bodies

    from_campobasso = await client.get(
        "/api/feed", params={"address": "Campobasso, Molise"}
    )
    assert from_campobasso.status_code == 200
    campobasso_bodies = [post["body"] for post in from_campobasso.json()["posts"]]
    assert "capracotta ciao" in campobasso_bodies
