"""Neighbour-count reach conversion tests.

``reach_for`` converts a post's voice intent (via the author's trust cap K)
into a distance ``reach_m`` by walking the radius ladder until it hits K
distinct *other* active posters. This is the conversion layer between the
fuzzy "voice" concept and the distance-based visibility rule (plan: Reach
model).

The static geocoder map provides addresses at several distances (Piazza
Venezia ~270m from Via Roma 1, Milano ~470km away, Capracotta/Campobasso in
Molise ~45km apart).
"""

import pytest
from sqlalchemy import select

from app.core.geocoder import STATIC_ADDRESSES
from app.models.location import Location
from app.services.feed import MAX_RADIUS_M
from app.services.reach import reach_for

VIA_ROMA = STATIC_ADDRESSES["via roma 1, roma"]  # (41.8933, 12.4829)
PIAZZA_VENEZIA = STATIC_ADDRESSES["piazza venezia, roma"]
MILANO = STATIC_ADDRESSES["milano centrale, milano"]
CAPRACOTTA = STATIC_ADDRESSES["capracotta, molise"]
CAMPOBASSO = STATIC_ADDRESSES["campobasso, molise"]


async def _post_at(client, address: str, body: str = "ciao", fresh_device: bool = True) -> str:
    """Create a post and return the author's device cookie value.

    By default each call clears the cookie jar so it mints a fresh device
    (a distinct neighbour). Pass ``fresh_device=False`` to reuse the current
    device.
    """
    if fresh_device:
        client.cookies.clear()
    response = await client.post(
        "/api/posts",
        json={"address": address, "body": body, "voice": "city"},
    )
    assert response.status_code == 201
    return response.cookies.get("device_id")


async def _location_for(session_factory, normalized_key: str) -> Location:
    async with session_factory() as session:
        location = await session.scalar(
            select(Location).where(Location.normalized_key == normalized_key)
        )
        assert location is not None
        return location


@pytest.mark.asyncio
async def test_reach_for_lone_author_spreads_to_max(client, session_factory) -> None:
    """A lone poster (K=1, nobody else) reaches the 50km ceiling."""
    author = await _post_at(client, "Via Roma 1, Roma")
    location = await _location_for(session_factory, "via roma 1, roma")
    async with session_factory() as session:
        reach = await reach_for(session, location, k=1, exclude_device_ids={author})
    assert reach == MAX_RADIUS_M


@pytest.mark.asyncio
async def test_reach_for_uses_smallest_radius_hitting_k(client, session_factory) -> None:
    """One neighbour at Piazza Venezia (~270m) resolves to the 500m step."""
    author = await _post_at(client, "Via Roma 1, Roma")
    await _post_at(client, "Piazza Venezia, Roma")
    location = await _location_for(session_factory, "via roma 1, roma")
    async with session_factory() as session:
        reach = await reach_for(session, location, k=1, exclude_device_ids={author})
    assert reach == 500


@pytest.mark.asyncio
async def test_reach_for_excludes_author_device(client, session_factory) -> None:
    """A single device posting twice does not count as two neighbours."""
    author = await _post_at(client, "Via Roma 1, Roma")
    await _post_at(client, "Via Roma 1, Roma", fresh_device=False)  # same device
    location = await _location_for(session_factory, "via roma 1, roma")
    async with session_factory() as session:
        reach = await reach_for(session, location, k=1, exclude_device_ids={author})
    assert reach == MAX_RADIUS_M


@pytest.mark.asyncio
async def test_reach_for_milano_requires_50km(client, session_factory) -> None:
    """A poster 470km away is never within the ladder, so reach = 50km."""
    author = await _post_at(client, "Milano Centrale, Milano")
    await _post_at(client, "Via Roma 1, Roma")
    location = await _location_for(session_factory, "milano centrale, milano")
    async with session_factory() as session:
        reach = await reach_for(session, location, k=1, exclude_device_ids={author})
    assert reach == MAX_RADIUS_M


@pytest.mark.asyncio
async def test_reach_for_without_exclusion_counts_author(client, session_factory) -> None:
    """Without excluding the author, the author counts toward K."""
    await _post_at(client, "Via Roma 1, Roma")
    location = await _location_for(session_factory, "via roma 1, roma")
    async with session_factory() as session:
        reach = await reach_for(session, location, k=1)
    assert reach == 500


@pytest.mark.asyncio
async def test_rural_new_users_read_each_other_from_45km(client) -> None:
    """Cold bootstrap in a rural area: two new users ~45km apart reach each other.

    Capracotta and Campobasso (Molise) are ~45km apart. Both authors are new
    (K = UNTRUSTED_K = 1); with no other posters nearby, each post's reach
    spreads to the 50km ceiling, so each user sees the other's post.
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

    from_campobasso = await client.get(
        "/api/feed", params={"address": "Campobasso, Molise"}
    )
    assert from_campobasso.status_code == 200
    campobasso_bodies = [post["body"] for post in from_campobasso.json()["posts"]]
    assert "capracotta ciao" in campobasso_bodies
    assert "campobasso ciao" in campobasso_bodies


@pytest.mark.asyncio
async def test_new_neighbours_with_closer_third_poster_still_read_each_other(client) -> None:
    """Design promise under pressure: two new users ~45km apart still see each
    other even when a third poster sits right next to one of them.

    Mirrors the production Ragusa case: two brand-new neighbours within 50km,
    plus a verification/test post on the same street as one of them. The UI
    reports "Entro 50 km" (effective_radius_m == MAX_RADIUS_M), but the reach
    model caps each author to K=1 *nearest* other poster, so the third poster
    collapses the reach to the 500m step and the far new neighbour is hidden.

    Currently FAILS (campobasso feed does not contain the capracotta post):
    this is the design tension between the count-based reach cap and the
    pairwise cold-bootstrap guarantee of ADR 0018.
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


@pytest.mark.asyncio
async def test_reach_for_collapses_when_a_closer_poster_exists(client, session_factory) -> None:
    """A third poster inside the 500m step collapses an untrusted author's reach.

    Reach is the radius of the *nearest* K=1 other poster, so one post on the
    same street turns a 50km cold-bootstrap spread into a 500m cap. This is the
    mechanism behind the collapsed feed above.
    """
    author = await _post_at(client, "Capracotta, Molise")
    await _post_at(client, "Capracotta, Molise")  # same street, new device
    await _post_at(client, "Campobasso, Molise")

    location = await _location_for(session_factory, "capracotta, molise")
    async with session_factory() as session:
        reach = await reach_for(session, location, k=1, exclude_device_ids={author})
    assert reach == 500