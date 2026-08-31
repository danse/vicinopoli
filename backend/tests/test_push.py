"""Push notification tests (DB-backed, real PostGIS).

Covered by ADR 0025: a subscription stores only the device's area as a geohash
cell (never an address or exact point); a notification fires when a new post's
reach covers that cell (plus ``CELL_SLACK_M``) and the post would appear in the
author's feed. The send path is a recording sender injected into
``notify_new_post``; the API routes exercise the real subscription lifecycle.
"""

import base64

from pywebpush import WebPushException

from app.core.geocoder import geohash_encode
from app.services.push import CELL_SLACK_M, notify_new_post

VALID_P256DH = base64.urlsafe_b64encode(b"\x04" + b"\x00" * 64).decode()
VALID_AUTH = base64.urlsafe_b64encode(b"\x00" * 16).decode()


class RecordingSender:
    """Collect deliveries instead of hitting a real push service."""

    def __init__(self) -> None:
        self.sent: list[dict] = []

    async def send(self, endpoint: str, p256dh: str, auth: str, payload: dict) -> None:
        self.sent.append(
            {"endpoint": endpoint, "p256dh": p256dh, "auth": auth, "payload": payload}
        )


async def _subscribe(client, address: str, endpoint: str = "https://push.example.test/sub") -> None:
    client.cookies.clear()  # fresh subscriber device
    response = await client.post(
        "/api/push/subscriptions",
        json={
            "endpoint": endpoint,
            "p256dh": VALID_P256DH,
            "auth": VALID_AUTH,
            "address": address,
        },
    )
    assert response.status_code == 201


async def _post(client, body: str, voice: str, address: str = "Via Roma 1, Roma") -> str:
    client.cookies.clear()  # fresh author device, distinct from the subscriber
    response = await client.post(
        "/api/posts", json={"address": address, "body": body, "voice": voice}
    )
    assert response.status_code == 201
    return response.json()["id"]


async def test_push_config_exposes_vapid_public_key(client) -> None:
    """``GET /api/push/config`` serves the auto-generated VAPID public key."""
    response = await client.get("/api/push/config")
    assert response.status_code == 200
    body = response.json()
    assert body["enabled"] is True
    assert body["vapid_public_key"]


async def test_subscribe_unknown_address_404(client) -> None:
    response = await client.post(
        "/api/push/subscriptions",
        json={
            "endpoint": "https://push.example.test/sub",
            "p256dh": VALID_P256DH,
            "auth": VALID_AUTH,
            "address": "Via Inesistente 99, Nowhere",
        },
    )
    assert response.status_code == 404


async def test_subscribe_stores_cell_not_address(client, session_factory) -> None:
    """The subscription stores a geohash cell centre, never the address."""
    await _subscribe(client, "Piazza Venezia, Roma", endpoint="https://push.example.test/a")

    async with session_factory() as session:
        from sqlalchemy import select

        from app.models.push_subscription import PushSubscription

        row = await session.scalar(select(PushSubscription))
        assert row is not None
        assert row.endpoint == "https://push.example.test/a"
        assert row.device_id is not None
        # Cell precision 7 (~150m), centred on Piazza Venezia.
        assert len(row.geohash) == 7
        assert row.geohash == geohash_encode(41.8957, 12.4823, 7)


async def test_resubscribe_updates_cell(client, session_factory) -> None:
    """Re-subscribing the same endpoint from a new address updates the cell."""
    await _subscribe(client, "Via Roma 1, Roma", endpoint="https://push.example.test/move")
    await _subscribe(client, "Piazza Venezia, Roma", endpoint="https://push.example.test/move")

    async with session_factory() as session:
        from sqlalchemy import func, select

        from app.models.push_subscription import PushSubscription

        count = await session.scalar(
            select(func.count()).select_from(PushSubscription)
        )
        row = await session.scalar(select(PushSubscription))
        assert count == 1
        assert row.geohash == geohash_encode(41.8957, 12.4823, 7)


async def test_unsubscribe_deletes(client, session_factory) -> None:
    await _subscribe(client, "Piazza Venezia, Roma", endpoint="https://push.example.test/gone")

    response = await client.request(
        "DELETE",
        "/api/push/subscriptions",
        json={"endpoint": "https://push.example.test/gone"},
    )
    assert response.status_code == 204

    async with session_factory() as session:
        from sqlalchemy import func, select

        from app.models.push_subscription import PushSubscription

        count = await session.scalar(
            select(func.count()).select_from(PushSubscription)
        )
        assert count == 0


async def test_list_subscriptions_returns_the_devices_endpoints(client) -> None:
    """``GET /api/push/subscriptions`` lists the calling device's endpoints, so
    the client can tell when the backend has dropped one (404/410 cleanup)."""
    await _subscribe(client, "Piazza Venezia, Roma", endpoint="https://push.example.test/a")

    response = await client.get("/api/push/subscriptions")
    assert response.status_code == 200
    assert response.json() == {"endpoints": ["https://push.example.test/a"]}

    delete = await client.request(
        "DELETE",
        "/api/push/subscriptions",
        json={"endpoint": "https://push.example.test/a"},
    )
    assert delete.status_code == 204

    response = await client.get("/api/push/subscriptions")
    assert response.status_code == 200
    assert response.json() == {"endpoints": []}


async def test_notify_delivers_when_reach_covers_subscriber(client, session_factory) -> None:
    """A ``some`` post (500m reach) at Via Roma covers Piazza Venezia (~270m)."""
    await _subscribe(client, "Piazza Venezia, Roma", endpoint="https://push.example.test/a")
    post_id = await _post(client, "ciao some", voice="some")

    sender = RecordingSender()
    await notify_new_post(session_factory, post_id, sender)

    assert len(sender.sent) == 1
    assert sender.sent[0]["endpoint"] == "https://push.example.test/a"
    payload = sender.sent[0]["payload"]
    assert payload["body"] == "ciao some"
    assert payload["voice"] == "some"
    assert payload["display_address"] == "Via Roma 1, Roma"


async def test_notify_payload_has_no_coordinates(client, session_factory) -> None:
    """The wire payload must not leak the post location or the address."""
    await _subscribe(client, "Piazza Venezia, Roma")
    post_id = await _post(client, "ciao some", voice="some")

    sender = RecordingSender()
    await notify_new_post(session_factory, post_id, sender)

    payload = sender.sent[0]["payload"]
    for forbidden in ("latitude", "longitude", "address", "geohash"):
        assert forbidden not in payload


async def test_notify_skips_post_outside_reach(client, session_factory) -> None:
    """A ``street`` post (5m reach) does not cover Piazza Venezia (~270m)."""
    await _subscribe(client, "Piazza Venezia, Roma")
    post_id = await _post(client, "ciao street", voice="street")

    sender = RecordingSender()
    await notify_new_post(session_factory, post_id, sender)

    assert sender.sent == []


async def test_notify_excludes_the_author(client, session_factory) -> None:
    """The author's own device is never notified about its own post."""
    # Subscribe with device A, then post WITHOUT clearing the cookie so the
    # author is the same device A (its ``city`` post would cover its cell).
    await _subscribe(client, "Piazza Venezia, Roma")
    response = await client.post(
        "/api/posts",
        json={"address": "Via Roma 1, Roma", "body": "ciao city", "voice": "city"},
    )
    assert response.status_code == 201
    post_id = response.json()["id"]

    sender = RecordingSender()
    await notify_new_post(session_factory, post_id, sender)

    assert sender.sent == []


async def test_notify_uses_cell_slack_above_reach(client, session_factory) -> None:
    """The search widens by CELL_SLACK_M beyond the post's reach."""
    assert CELL_SLACK_M > 0


async def test_webpush_sender_calls_webpush_with_base64url_keys(monkeypatch) -> None:
    """Regression: the sender must hand pywebpush's ``webpush()`` the stored
    base64url strings verbatim (it decodes them itself) with a JSON-serialized
    payload and VAPID signing — pre-decoded raw bytes or per-kwargs ``send``
    both made every delivery fail in prod."""
    captured: dict[str, object] = {}

    def fake_webpush(**kwargs) -> None:
        captured["kwargs"] = kwargs

    monkeypatch.setattr("pywebpush.webpush", fake_webpush)

    from app.services.push import WebPushSender

    await WebPushSender().send(
        "https://push.example.test/sub",
        VALID_P256DH,
        VALID_AUTH,
        {"body": "ciao", "voice": "some"},
    )

    import json

    kwargs = captured["kwargs"]
    info = kwargs["subscription_info"]
    assert info["endpoint"] == "https://push.example.test/sub"
    assert info["keys"]["p256dh"] == VALID_P256DH
    assert info["keys"]["auth"] == VALID_AUTH
    assert json.loads(kwargs["data"]) == {"body": "ciao", "voice": "some"}
    assert kwargs["vapid_private_key"] is not None
    assert kwargs["vapid_claims"]["sub"]


def _fake_response(status_code: int):
    return type("FakeResponse", (), {"status_code": status_code})


class GoneSender:
    """Deliver to every endpoint except the dead ones (which raise 404/410)."""

    def __init__(self, gone: set[str]) -> None:
        self.sent: list[str] = []
        self.gone = gone

    async def send(self, endpoint: str, p256dh: str, auth: str, payload: dict) -> None:
        if endpoint in self.gone:
            raise WebPushException(
                "Push failed: 410 Gone", response=_fake_response(410)
            )
        self.sent.append(endpoint)


class ErrorSender:
    """Fail every delivery with a transient error."""

    async def send(self, endpoint: str, p256dh: str, auth: str, payload: dict) -> None:
        raise WebPushException("Push failed: 500", response=_fake_response(500))


async def test_notify_deletes_dead_subscriptions(client, session_factory) -> None:
    """A 410/404 from the push service means the subscription is permanently
    gone: the row is deleted (so it stops being retried on every covered post)
    instead of raising to Sentry, and other subscribers are still delivered."""
    await _subscribe(client, "Piazza Venezia, Roma", endpoint="https://push.example.test/alive")
    await _subscribe(client, "Piazza Venezia, Roma", endpoint="https://push.example.test/gone")

    post_id = await _post(client, "ciao some", voice="some")

    sender = GoneSender(gone={"https://push.example.test/gone"})
    await notify_new_post(session_factory, post_id, sender)

    assert sender.sent == ["https://push.example.test/alive"]

    async with session_factory() as session:
        from sqlalchemy import select

        from app.models.push_subscription import PushSubscription

        remaining = await session.scalars(select(PushSubscription))
        assert [row.endpoint for row in remaining] == [
            "https://push.example.test/alive"
        ]


async def test_notify_keeps_subscription_on_transient_error(client, session_factory) -> None:
    """A non-404/410 failure (e.g. a 500 or a network error) is logged, never
    propagates, and the subscription is kept for the next attempt."""
    await _subscribe(client, "Piazza Venezia, Roma", endpoint="https://push.example.test/a")
    post_id = await _post(client, "ciao some", voice="some")

    await notify_new_post(session_factory, post_id, ErrorSender())

    async with session_factory() as session:
        from sqlalchemy import select

        from app.models.push_subscription import PushSubscription

        remaining = await session.scalars(select(PushSubscription))
        assert [row.endpoint for row in remaining] == [
            "https://push.example.test/a"
        ]