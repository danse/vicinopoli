"""Experiment foundation tests (ADR 0014).

The device carries a stable experiment segment and a GDPR consent flag.
Analytics events are only stored when the device has consented.
"""

import pytest

from app.services.experiments import feature_flags


@pytest.mark.asyncio
async def test_device_exposes_segment_flags_and_consent(client) -> None:
    response = await client.get("/api/me")
    assert response.status_code == 200
    data = response.json()
    assert 0 <= data["experiment_segment"] < 100
    assert isinstance(data["experiment_flags"], dict)
    assert data["analytics_consent"] is None or isinstance(data["analytics_consent"], bool)


def test_heatmap_flag_off_for_all_segments() -> None:
    """The heatmap UI is hidden behind a feature flag, off everywhere for now."""
    for segment in range(100):
        flags = feature_flags(segment)
        assert "heatmap" in flags
        assert flags["heatmap"] is False


@pytest.mark.asyncio
async def test_events_dropped_without_consent(client) -> None:
    await client.get("/api/me")  # mint device, no consent
    response = await client.post(
        "/api/events",
        json={"events": [{"name": "post_viewed"}]},
    )
    assert response.status_code == 202
    assert response.json() == {"accepted": 1, "stored": 0}


@pytest.mark.asyncio
async def test_consent_opt_in_then_events_stored(client) -> None:
    await client.get("/api/me")
    updated = await client.patch("/api/me", json={"analytics_consent": True})
    assert updated.status_code == 200
    assert updated.json()["analytics_consent"] is True

    response = await client.post(
        "/api/events",
        json={"events": [{"name": "post_viewed"}, {"name": "onboarding_completed"}]},
    )
    assert response.status_code == 202
    assert response.json() == {"accepted": 2, "stored": 2}


@pytest.mark.asyncio
async def test_events_reject_unknown_name(client) -> None:
    await client.patch("/api/me", json={"analytics_consent": True})
    response = await client.post(
        "/api/events",
        json={"events": [{"name": "teleported"}]},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_post_created_event_stored_after_consent(client) -> None:
    await client.get("/api/me")
    await client.patch("/api/me", json={"analytics_consent": True})

    posted = await client.post(
        "/api/posts",
        json={"address": "Via Roma 1, Roma", "body": "ciao", "scope": "1km"},
    )
    assert posted.status_code == 201
    post_id = posted.json()["id"]

    response = await client.post(
        "/api/events",
        json={"events": [{"name": "post_created", "post_id": post_id}]},
    )
    assert response.status_code == 202
    assert response.json()["stored"] == 1


@pytest.mark.asyncio
async def test_event_occurred_at_is_stored(client, session_factory) -> None:
    """The client-reported moment (occurred_at) is persisted alongside the row."""
    from sqlalchemy import select

    from app.models.analytics_event import AnalyticsEvent

    await client.get("/api/me")
    await client.patch("/api/me", json={"analytics_consent": True})

    response = await client.post(
        "/api/events",
        json={
            "events": [
                {
                    "name": "post_viewed",
                    "geohash": "sr1m9h",
                    "occurred_at": "2026-08-19T10:00:00Z",
                }
            ]
        },
    )
    assert response.status_code == 202
    assert response.json()["stored"] == 1

    async with session_factory() as session:
        rows = (await session.execute(select(AnalyticsEvent))).scalars().all()

    assert len(rows) == 1
    assert rows[0].geohash == "sr1m9h"
    assert rows[0].occurred_at is not None
    assert rows[0].occurred_at.year == 2026


@pytest.mark.asyncio
async def test_address_set_event_stored_after_consent(client, session_factory) -> None:
    """The first-address-set milestone is its own event, distinct from consent."""
    from sqlalchemy import select

    from app.models.analytics_event import AnalyticsEvent

    await client.get("/api/me")
    await client.patch("/api/me", json={"analytics_consent": True})

    response = await client.post(
        "/api/events",
        json={"events": [{"name": "address_set"}]},
    )
    assert response.status_code == 202
    assert response.json()["stored"] == 1

    async with session_factory() as session:
        rows = (await session.execute(select(AnalyticsEvent))).scalars().all()

    assert len(rows) == 1
    assert rows[0].name == "address_set"
