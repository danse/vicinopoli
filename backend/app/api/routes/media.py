"""Media endpoints (ADR 0013).

``POST /api/media/presign`` issues a write-once presigned PUT URL; the client
uploads directly to MinIO. ``POST /api/media/register`` records the object and
returns its id for use in ``PostCreate.media_ids``.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_device, get_session
from app.models.device import Device
from app.models.media import Media, MediaKind
from app.schemas.media import (
    MediaPresignRequest,
    MediaPresignResponse,
    MediaRegistered,
    MediaRegisterRequest,
)
from app.services.storage import build_object_key, presign_put

router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_session)]

MAX_SIZE_BYTES = {
    MediaKind.image: 10 * 1024 * 1024,
    MediaKind.voice: 30 * 1024 * 1024,
}


@router.post("/media/presign", response_model=MediaPresignResponse)
async def presign(
    payload: MediaPresignRequest,
    session: SessionDep,
    device: Annotated[Device, Depends(get_device)],
) -> MediaPresignResponse:
    kind = MediaKind(payload.kind)
    if payload.size > MAX_SIZE_BYTES[kind]:
        raise HTTPException(status_code=422, detail="file too large")

    object_key = build_object_key(payload.kind, payload.content_type)
    url = presign_put(object_key)
    await session.commit()
    return MediaPresignResponse(
        object_key=object_key,
        url=url,
        kind=payload.kind,
        content_type=payload.content_type,
        size=payload.size,
    )


@router.post("/media/register", response_model=MediaRegistered, status_code=201)
async def register_media(
    payload: MediaRegisterRequest,
    session: SessionDep,
    device: Annotated[Device, Depends(get_device)],
) -> MediaRegistered:
    kind = MediaKind(payload.kind)
    if payload.size > MAX_SIZE_BYTES[kind]:
        raise HTTPException(status_code=422, detail="file too large")

    media = Media(
        kind=payload.kind,
        object_key=payload.object_key,
        content_type=payload.content_type,
        size=payload.size,
        duration_s=payload.duration_s,
    )
    session.add(media)
    await session.commit()
    await session.refresh(media)
    return MediaRegistered(
        id=media.id,
        kind=media.kind,
        object_key=media.object_key,
        content_type=media.content_type,
        size=media.size,
    )