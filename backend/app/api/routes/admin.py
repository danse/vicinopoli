"""Internal admin firehose (ADR 0021).

``GET /api/admin/posts`` lists every post regardless of visibility scope or
status (active, auto-hidden, hidden), newest first, so a human moderator can
review all submitted content. The route is gated by the shared ``ADMIN_TOKEN``
and is only reachable on the loopback interface in both compose files.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, require_admin
from app.models.device import Device
from app.models.location import Location
from app.models.post import Post
from app.models.report import Report
from app.schemas.admin import AdminFeedResponse, AdminPost
from app.services.feed import decode_cursor, encode_cursor
from app.services.media import media_by_post, media_info
from app.services.trust import is_new_neighbour

router = APIRouter(dependencies=[Depends(require_admin)])

SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get("/admin/posts", response_model=AdminFeedResponse)
async def get_admin_posts(
    session: SessionDep,
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None),
) -> AdminFeedResponse:
    """Return a page of all posts, newest first, with report counts.

    Keyset pagination mirrors the public feed: ``next_cursor`` encodes the last
    post's ``(created_at, id)`` and the next request resumes strictly after it.
    """
    if cursor is not None:
        try:
            cursor_key = decode_cursor(cursor)
        except Exception:
            raise HTTPException(status_code=400, detail="invalid cursor") from None
    else:
        cursor_key = None

    report_count = func.count(Report.id)
    stmt = (
        select(
            Post,
            Location,
            Device,
            report_count.label("report_count"),
        )
        .join(Location, Post.location_id == Location.id)
        .outerjoin(Device, Post.device_id == Device.id)
        .outerjoin(Report, Report.post_id == Post.id)
        .group_by(Post.id, Location.id, Device.id)
        .order_by(Post.created_at.desc(), Post.id.desc())
        .limit(limit + 1)
    )
    if cursor_key is not None:
        cursor_ts, cursor_id = cursor_key
        stmt = stmt.where(
            (Post.created_at < cursor_ts)
            | ((Post.created_at == cursor_ts) & (Post.id < cursor_id))
        )

    rows = (await session.execute(stmt)).all()
    page = rows[:limit]
    has_more = len(rows) > limit

    post_ids = [post.id for post, _, _, _ in page]
    media_by_id = await media_by_post(session, [str(pid) for pid in post_ids])

    posts = [
        AdminPost(
            id=post.id,
            body=post.body,
            voice=post.voice,
            status=post.status,
            display_address=location.display_address,
            geohash=location.geohash,
            created_at=post.created_at,
            pseudonym=device.pseudonym if device is not None else None,
            new_neighbour=is_new_neighbour(device) if device is not None else True,
            report_count=int(report_count_value),
            device_id=post.device_id,
            media=media_info(media_by_id.get(str(post.id), [])),
        )
        for post, location, device, report_count_value in page
    ]

    next_cursor: str | None = None
    if has_more and posts:
        last = posts[-1]
        next_cursor = encode_cursor(last.created_at, last.id)

    return AdminFeedResponse(posts=posts, next_cursor=next_cursor)
