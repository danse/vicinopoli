"""Link previews (ADR 0028): the single source of truth for the API contract.

TypeScript types are generated from these via ``make gen`` — never
hand-maintain duplicate types in the frontend.
"""

from pydantic import BaseModel, Field


class LinkPreviewResponse(BaseModel):
    url: str = Field(max_length=2048)
    title: str | None = None
    description: str | None = None
    image_url: str | None = None
    provider_name: str | None = None
    provider_url: str | None = None
    type: str | None = None