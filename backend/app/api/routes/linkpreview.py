"""Link-preview proxy (ADR 0028)."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import get_device, get_preview_fetcher, get_preview_rate_limiter
from app.core.ratelimit import RateLimiter
from app.models.device import Device
from app.schemas.linkpreview import LinkPreviewResponse
from app.services.linkpreview import LinkPreviewFetcher

router = APIRouter()

PreviewFetcherDep = Annotated[LinkPreviewFetcher, Depends(get_preview_fetcher)]
DeviceDep = Annotated[Device, Depends(get_device)]
RateLimiterDep = Annotated[RateLimiter | None, Depends(get_preview_rate_limiter)]


@router.get("/preview", response_model=LinkPreviewResponse)
async def get_preview(
    fetcher: PreviewFetcherDep,
    device: DeviceDep,
    rate_limiter: RateLimiterDep,
    url: str = Query(min_length=1, max_length=2048),
) -> LinkPreviewResponse:
    if rate_limiter is not None and not rate_limiter.allow(f"preview:{device.id}"):
        raise HTTPException(status_code=429, detail="rate limit exceeded")
    preview = await fetcher.preview(url)
    if preview is None:
        raise HTTPException(status_code=404, detail="no preview available")
    return preview