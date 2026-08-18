"""Push notification API contracts (ADR 0025)."""

from pydantic import BaseModel, Field


class PushConfigResponse(BaseModel):
    """VAPID public key the browser needs to subscribe (RFC 8292)."""

    enabled: bool
    vapid_public_key: str


class PushSubscriptionCreate(BaseModel):
    """Register a Web Push subscription for the calling device.

    ``address`` is sent on the wire for geocoding (as post creation does) but
    only a geohash cell centre is persisted — never the address or an exact
    point.
    """

    endpoint: str = Field(min_length=8, max_length=512)
    p256dh: str = Field(min_length=8, max_length=256)
    auth: str = Field(min_length=8, max_length=256)
    address: str = Field(min_length=1, max_length=512)


class PushSubscriptionDelete(BaseModel):
    """Remove a previously registered subscription by its endpoint."""

    endpoint: str = Field(min_length=8, max_length=512)