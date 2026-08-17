"""Device identity endpoints (ADR 0005).

``GET /api/me`` lazily mints the anonymous device cookie and returns the public
device profile; ``PATCH /api/me`` sets or clears the optional pseudonym.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_device, get_session
from app.models.device import Device
from app.schemas.identity import DeviceResponse, DeviceUpdate
from app.services.experiments import feature_flags
from app.services.quota import posts_left_today
from app.services.trust import daily_post_quota, is_new_neighbour

router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def _response(session: AsyncSession, device: Device) -> DeviceResponse:
    segment = device.experiment_segment
    return DeviceResponse(
        id=device.id,
        pseudonym=device.pseudonym,
        new_neighbour=is_new_neighbour(device),
        daily_post_limit=daily_post_quota(device),
        posts_left_today=await posts_left_today(session, device),
        created_at=device.created_at,
        experiment_segment=segment,
        experiment_flags=feature_flags(segment),
        analytics_consent=device.analytics_consent,
    )


@router.get("/me", response_model=DeviceResponse)
async def get_me(
    device: Annotated[Device, Depends(get_device)],
    session: SessionDep,
) -> DeviceResponse:
    await session.commit()
    return await _response(session, device)


@router.patch("/me", response_model=DeviceResponse)
async def update_me(
    payload: DeviceUpdate,
    device: Annotated[Device, Depends(get_device)],
    session: SessionDep,
) -> DeviceResponse:
    if payload.pseudonym is not None:
        device.pseudonym = payload.pseudonym if payload.pseudonym else None
    if payload.analytics_consent is not None:
        device.analytics_consent = payload.analytics_consent
    await session.commit()
    await session.refresh(device)
    return await _response(session, device)
