"""Analytics events endpoint (ADR 0014).

``POST /api/events`` accepts a batch of privacy-safe analytics events. Events
are stored only when the device has granted GDPR consent; otherwise they are
silently dropped. The endpoint is best-effort (202) and never blocks the flow.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_device, get_session
from app.models.analytics_event import AnalyticsEvent
from app.models.device import Device
from app.schemas.experiments import (
    AnalyticsEventBatch,
    AnalyticsEventResult,
)

router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.post("/events", response_model=AnalyticsEventResult, status_code=202)
async def post_events(
    payload: AnalyticsEventBatch,
    session: SessionDep,
    device: Annotated[Device, Depends(get_device)],
) -> AnalyticsEventResult:
    accepted = len(payload.events)
    if not device.analytics_consent:
        await session.commit()
        return AnalyticsEventResult(accepted=accepted, stored=0)

    for event in payload.events:
        session.add(
            AnalyticsEvent(
                device_id=device.id,
                name=event.name,
                geohash=event.geohash,
                post_id=event.post_id,
                occurred_at=event.occurred_at,
            )
        )
    await session.commit()
    return AnalyticsEventResult(accepted=accepted, stored=accepted)