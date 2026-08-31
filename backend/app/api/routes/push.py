"""Push notification endpoints (ADR 0025).

- ``GET    /api/push/config`` — VAPID public key for ``pushManager.subscribe``.
- ``POST   /api/push/subscriptions`` — register the calling device's Web Push
  subscription, storing only the geohash cell centre of the given address.
- ``DELETE /api/push/subscriptions`` — remove a subscription (opt-out).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_device, get_geocoder, get_session
from app.core.geocoder import Geocoder, geohash_decode
from app.models.device import Device
from app.models.push_subscription import PushSubscription
from app.schemas.push import (
    PushConfigResponse,
    PushSubscriptionCreate,
    PushSubscriptionDelete,
    PushSubscriptionsResponse,
)
from app.services.push import CELL_PRECISION
from app.services.vapid import vapid_keys

router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_session)]
GeocoderDep = Annotated[Geocoder, Depends(get_geocoder)]
DeviceDep = Annotated[Device, Depends(get_device)]


@router.get("/push/config", response_model=PushConfigResponse)
async def push_config() -> PushConfigResponse:
    public_key, _ = vapid_keys()
    return PushConfigResponse(enabled=True, vapid_public_key=public_key)


@router.get("/push/subscriptions", response_model=PushSubscriptionsResponse)
async def list_subscriptions(
    session: SessionDep,
    device: DeviceDep,
) -> PushSubscriptionsResponse:
    """The calling device's registered endpoints (client-side self-healing)."""
    rows = await session.scalars(
        select(PushSubscription).where(PushSubscription.device_id == device.id)
    )
    return PushSubscriptionsResponse(endpoints=[row.endpoint for row in rows])


@router.post("/push/subscriptions", status_code=status.HTTP_201_CREATED)
async def subscribe(
    payload: PushSubscriptionCreate,
    session: SessionDep,
    geocoder: GeocoderDep,
    device: DeviceDep,
) -> None:
    """Register the device's subscription, keyed by the Web Push endpoint.

    The address is geocoded like a post's, but only the geohash cell centre is
    persisted — re-subscribing from a new address moves the cell.
    """
    geocoded = await geocoder.geocode(payload.address)
    if geocoded is None:
        raise HTTPException(status_code=404, detail="address not found")

    cell = geocoded.geohash[:CELL_PRECISION]
    lat_min, lon_min, lat_max, lon_max = geohash_decode(cell)
    latitude = (lat_min + lat_max) / 2
    longitude = (lon_min + lon_max) / 2

    row = await session.scalar(
        select(PushSubscription).where(PushSubscription.endpoint == payload.endpoint)
    )
    if row is None:
        row = PushSubscription(endpoint=payload.endpoint)
        session.add(row)
    row.device_id = device.id
    row.p256dh = payload.p256dh
    row.auth = payload.auth
    row.latitude = latitude
    row.longitude = longitude
    row.geohash = cell
    row.point = func.ST_GeogFromText(f"SRID=4326;POINT({longitude} {latitude})")
    await session.commit()


@router.delete("/push/subscriptions", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe(
    payload: PushSubscriptionDelete,
    session: SessionDep,
) -> None:
    """Remove the subscription for the given endpoint (opt-out)."""
    row = await session.scalar(
        select(PushSubscription).where(PushSubscription.endpoint == payload.endpoint)
    )
    if row is not None:
        await session.delete(row)
        await session.commit()