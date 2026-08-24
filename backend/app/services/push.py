"""Push notification service (ADR 0025).

A notification fires when a new post's **reach** covers a subscriber's area:
the single ``ST_DWithin`` query widens by ``CELL_SLACK_M`` to absorb the
geohash-cell approximation, and the author's own device is always excluded.
The wire payload carries the post body, voice, display address and timestamp —
never coordinates or the author's identity.

The send path is injectable: ``PUSH_SENDER=mock`` (dev/test) HTTP-POSTs the
payload to the subscription's endpoint verbatim (e2e points it at the admin
inbox), ``PUSH_SENDER=webpush`` signs and delivers via ``pywebpush``.
"""

from __future__ import annotations

import logging
from typing import Protocol

import httpx
from geoalchemy2 import functions as geo_func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.post import Post
from app.models.push_subscription import PushSubscription
from app.services.reach import VOICE_TO_REACH_M
from app.services.vapid import vapid_keys

logger = logging.getLogger(__name__)

# Subscriber-area cell granularity (geohash prefix length, ~150m cells).
CELL_PRECISION: int = 7

# Half the diagonal of a precision-7 cell, so a subscriber at a cell edge is
# never missed when the post would reach their real address.
CELL_SLACK_M: int = 110


class PushSender(Protocol):
    async def send(
        self, endpoint: str, p256dh: str, auth: str, payload: dict[str, object]
    ) -> None: ...


class MockPushSender:
    """Deliver by POSTing the payload to the subscription's endpoint verbatim.

    Dev/test only: e2e points the endpoint at the admin inbox so the full
    pipeline is asserted without a real push service.
    """

    async def send(
        self, endpoint: str, p256dh: str, auth: str, payload: dict[str, object]
    ) -> None:
        headers = {"X-Admin-Token": settings.admin_token} if settings.admin_token else {}
        async with httpx.AsyncClient() as client:
            await client.post(endpoint, json=payload, headers=headers, timeout=10)


class WebPushSender:
    """Deliver via the Web Push protocol, signed with the VAPID private key.

    ``pywebpush``'s one-call ``webpush()`` decodes the base64url keys itself and
    signs the payload with the VAPID key; the subscription's stored
    ``p256dh``/``auth`` strings are passed through verbatim and the payload is
    JSON-serialized (``WebPusher.send`` in this version takes no VAPID kwargs).
    """

    async def send(
        self, endpoint: str, p256dh: str, auth: str, payload: dict[str, object]
    ) -> None:
        import json

        from pywebpush import webpush  # type: ignore[import-untyped]

        _, private_key = vapid_keys()
        webpush(
            subscription_info={
                "endpoint": endpoint,
                "keys": {
                    "p256dh": p256dh,
                    "auth": auth,
                },
            },
            data=json.dumps(payload),
            vapid_private_key=private_key,
            vapid_claims={"sub": settings.vapid_subject},
            timeout=10,
        )


def get_push_sender() -> PushSender:
    """The sender configured for this environment."""
    if settings.push_sender == "webpush":
        return WebPushSender()
    return MockPushSender()


def _payload_for(post: Post, display_address: str) -> dict[str, object]:
    """The wire payload — deliberately free of coordinates and identity."""
    return {
        "body": post.body,
        "voice": post.voice,
        "display_address": display_address,
        "created_at": post.created_at.isoformat(),
    }


async def notify_new_post(
    session_factory: async_sessionmaker[AsyncSession],
    post_id: object,
    sender: PushSender,
) -> None:
    """Notify subscribers whose cell is covered by a new post's reach.

    Runs after the post is committed (FastAPI ``BackgroundTask``), so it opens
    its own session. Failures are logged per subscriber and never fail the
    response.
    """
    async with session_factory() as session:
        post = await session.scalar(
            select(Post).options(selectinload(Post.location)).where(Post.id == post_id)
        )
        if post is None or post.status.value != "active":
            return
        reach_m = VOICE_TO_REACH_M[post.voice]
        post_geog = geo_func.ST_GeogFromText(
            f"SRID=4326;POINT({post.location.longitude} {post.location.latitude})"
        )
        subs = await session.scalars(
            select(PushSubscription).where(
                PushSubscription.device_id != post.device_id,
                geo_func.ST_DWithin(
                    PushSubscription.point, post_geog, reach_m + CELL_SLACK_M
                ),
            )
        )
        payload = _payload_for(post, post.location.display_address)
        for sub in subs:
            try:
                await sender.send(sub.endpoint, sub.p256dh, sub.auth, payload)
            except Exception:
                logger.exception(
                    "push delivery failed", extra={"endpoint": sub.endpoint}
                )