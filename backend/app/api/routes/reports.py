"""Report workflow endpoints (ADR 0009).

``POST /api/posts/{post_id}/report`` records a report from the calling device.
Once a post receives reports from ``report_threshold`` distinct devices it is
auto-hidden and disappears from the feed.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_device, get_session
from app.core.config import settings
from app.models.device import Device
from app.models.location import Location
from app.models.post import Post, PostStatus
from app.models.report import Report, ReportStatus
from app.schemas.report import ReportResponse
from app.services.heatmap import shrink_activity_cell

router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.post("/posts/{post_id}/report", response_model=ReportResponse, status_code=201)
async def report_post(
    post_id: UUID,
    session: SessionDep,
    device: Annotated[Device, Depends(get_device)],
) -> ReportResponse:
    post = await session.get(Post, post_id)
    if post is None or post.status == PostStatus.hidden:
        raise HTTPException(status_code=404, detail="post not found")

    existing = await session.scalar(
        select(Report).where(Report.post_id == post_id, Report.device_id == device.id)
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="already reported")

    report = Report(post_id=post_id, device_id=device.id, status=ReportStatus.submitted)
    session.add(report)
    await session.flush()

    distinct_devices = await session.scalar(
        select(func.count(func.distinct(Report.device_id))).where(Report.post_id == post_id)
    )
    assert distinct_devices is not None
    if distinct_devices >= settings.report_threshold and post.status == PostStatus.active:
        post.status = PostStatus.auto_hidden
        location = await session.get(Location, post.location_id)
        if location is not None:
            await shrink_activity_cell(session, location)

    post_status = post.status
    await session.commit()
    await session.refresh(report)

    return ReportResponse(
        id=report.id,
        post_id=report.post_id,
        status=report.status.value,
        post_status=post_status,
        created_at=report.created_at,
    )
