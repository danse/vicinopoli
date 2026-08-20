"""Link previews (ADR 0028): oEmbed/OpenGraph resolution + SSRF guard.

The fetcher's ``_fetch`` seam is monkeypatched (the geocoder test pattern) so
tests never touch the network.
"""

import pytest
from httpx import Request, Response

from app.schemas.linkpreview import LinkPreviewResponse
from app.services.linkpreview import LinkPreviewFetcher

BASIC_HTML = """<!doctype html><html><head>
<title>Plain title</title>
<meta name="description" content="A description">
</head><body></body></html>"""

OG_HTML = """<!doctype html><html><head>
<meta property="og:title" content="Card title"/>
<meta property="og:description" content="Card description"/>
<meta property="og:image" content="/img.jpg"/>
<meta property="og:site_name" content="Example Site"/>
<meta property="og:type" content="article"/>
</head><body></body></html>"""

OEMBED_JSON = {
    "title": "A video",
    "author_name": "An Author",
    "author_url": "https://example.com/author",
    "thumbnail_url": "https://example.com/thumb.jpg",
    "provider_name": "YouTube",
    "type": "video",
}


def make_fetcher(fetch) -> LinkPreviewFetcher:
    fetcher = LinkPreviewFetcher(timeout=0.1, ttl_seconds=3600)
    fetcher._fetch = fetch  # type: ignore[method-assign]
    return fetcher


def text_response(text: str, status: int = 200) -> Response:
    return Response(status, content=text.encode(), request=Request("GET", "http://test"))


def json_response(data: dict, status: int = 200) -> Response:
    return Response(status, json=data, request=Request("GET", "http://test"))


@pytest.mark.asyncio
async def test_youtube_url_uses_oembed_endpoint() -> None:
    calls: list[str] = []

    async def fetch(url: str) -> Response:
        calls.append(url)
        return json_response(OEMBED_JSON)

    fetcher = make_fetcher(fetch)
    result = await fetcher.preview("https://www.youtube.com/watch?v=dQw4w9WgXcQ")

    assert calls[0].startswith("https://www.youtube.com/oembed?url=")
    assert calls[0].endswith("&format=json")
    assert result is not None
    assert result.title == "A video"
    assert result.image_url == "https://example.com/thumb.jpg"
    assert result.provider_name == "An Author"
    assert result.type == "video"


@pytest.mark.asyncio
async def test_youtu_be_short_link_uses_oembed() -> None:
    calls: list[str] = []

    async def fetch(url: str) -> Response:
        calls.append(url)
        return json_response(OEMBED_JSON)

    fetcher = make_fetcher(fetch)
    await fetcher.preview("https://youtu.be/dQw4w9WgXcQ")
    assert calls[0].startswith("https://www.youtube.com/oembed?url=")


@pytest.mark.asyncio
async def test_soundcloud_and_reddit_use_their_oembed() -> None:
    calls: list[str] = []

    async def fetch(url: str) -> Response:
        calls.append(url)
        return json_response({"title": "x"})

    fetcher = make_fetcher(fetch)
    await fetcher.preview("https://soundcloud.com/radiohead/creep")
    assert calls[0].startswith("https://soundcloud.com/oembed?url=")
    await fetcher.preview("https://www.reddit.com/r/aww/comments/abc/title/")
    assert calls[1].startswith("https://www.reddit.com/oembed?url=")


@pytest.mark.asyncio
async def test_unknown_host_falls_back_to_open_graph() -> None:
    calls: list[str] = []

    async def fetch(url: str) -> Response:
        calls.append(url)
        return text_response(OG_HTML)

    fetcher = make_fetcher(fetch)
    result = await fetcher.preview("https://example.com/some-article")

    assert calls == ["https://example.com/some-article"]
    assert result is not None
    assert result.title == "Card title"
    assert result.description == "Card description"
    assert result.image_url == "https://example.com/img.jpg"
    assert result.provider_name == "Example Site"
    assert result.type == "article"


@pytest.mark.asyncio
async def test_fallback_uses_title_and_meta_description() -> None:
    async def fetch(url: str) -> Response:
        return text_response(BASIC_HTML)

    fetcher = make_fetcher(fetch)
    result = await fetcher.preview("https://example.com/no-og")

    assert result is not None
    assert result.title == "Plain title"
    assert result.description == "A description"
    assert result.image_url is None


@pytest.mark.asyncio
async def test_no_metadata_yields_no_preview() -> None:
    async def fetch(url: str) -> Response:
        return text_response("<html><head></head></html>")

    fetcher = make_fetcher(fetch)
    assert await fetcher.preview("https://example.com/empty") is None


@pytest.mark.asyncio
async def test_og_image_data_uri_is_rejected() -> None:
    html = OG_HTML.replace('content="/img.jpg"', 'content="data:image/png;base64,AA=="')
    async def fetch(url: str) -> Response:
        return text_response(html)

    fetcher = make_fetcher(fetch)
    result = await fetcher.preview("https://example.com/img")
    assert result is not None
    assert result.image_url is None


@pytest.mark.asyncio
async def test_oembed_http_error_returns_none() -> None:
    async def fetch(url: str) -> Response:
        return Response(500, request=Request("GET", "http://test"))

    fetcher = make_fetcher(fetch)
    assert await fetcher.preview("https://www.youtube.com/watch?v=x") is None


@pytest.mark.asyncio
async def test_successful_result_is_cached() -> None:
    calls: list[str] = []

    async def fetch(url: str) -> Response:
        calls.append(url)
        return text_response(OG_HTML)

    fetcher = make_fetcher(fetch)
    first = await fetcher.preview("https://example.com/cached")
    second = await fetcher.preview("https://example.com/cached")

    assert first is not None and second is not None
    assert first.title == second.title
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_non_http_scheme_is_rejected() -> None:
    async def fetch(url: str) -> Response:
        raise AssertionError("must not fetch")

    fetcher = make_fetcher(fetch)
    assert await fetcher.preview("ftp://example.com/file") is None
    assert await fetcher.preview("javascript:alert(1)") is None


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/private",
        "http://localhost/internal",
        "http://10.0.0.5/internal",
        "http://192.168.1.1/internal",
        "http://169.254.169.254/latest/meta-data/",
        "http://[::1]/internal",
    ],
)
@pytest.mark.asyncio
async def test_ssrf_blocks_private_targets(url: str) -> None:
    async def fetch(url: str) -> Response:
        raise AssertionError("must not fetch blocked targets")

    fetcher = make_fetcher(fetch)
    assert await fetcher.preview(url) is None


@pytest.mark.asyncio
async def test_public_target_is_fetched() -> None:
    calls: list[str] = []

    async def fetch(url: str) -> Response:
        calls.append(url)
        return text_response(OG_HTML)

    fetcher = make_fetcher(fetch)
    result = await fetcher.preview("https://example.com/article")
    assert result is not None
    assert calls == ["https://example.com/article"]


class StubPreviewFetcher:
    def __init__(self, result: LinkPreviewResponse | None = None) -> None:
        self.result = result
        self.urls: list[str] = []

    async def preview(self, url: str) -> LinkPreviewResponse | None:
        self.urls.append(url)
        return self.result


def override_preview_deps(result, rate_limiter=None):
    from app.api.deps import get_preview_fetcher, get_preview_rate_limiter
    from app.main import app

    stub = StubPreviewFetcher(result)
    app.dependency_overrides[get_preview_fetcher] = lambda: stub
    app.dependency_overrides[get_preview_rate_limiter] = lambda: rate_limiter
    return stub


def clear_preview_deps() -> None:
    from app.api.deps import get_preview_fetcher, get_preview_rate_limiter
    from app.main import app

    app.dependency_overrides.pop(get_preview_fetcher, None)
    app.dependency_overrides.pop(get_preview_rate_limiter, None)


@pytest.mark.asyncio
async def test_preview_endpoint_returns_metadata(client) -> None:
    preview = LinkPreviewResponse(
        url="https://example.com/a",
        title="Example",
        description="A page",
        image_url="https://example.com/img.jpg",
        provider_name="Example Site",
    )
    stub = override_preview_deps(preview)
    try:
        response = await client.get("/api/preview", params={"url": "https://example.com/a"})
    finally:
        clear_preview_deps()

    assert response.status_code == 200
    assert response.json()["title"] == "Example"
    assert response.json()["provider_name"] == "Example Site"
    assert stub.urls == ["https://example.com/a"]


@pytest.mark.asyncio
async def test_preview_endpoint_404_when_no_metadata(client) -> None:
    override_preview_deps(None)
    try:
        response = await client.get("/api/preview", params={"url": "https://example.com/a"})
    finally:
        clear_preview_deps()

    assert response.status_code == 404
    assert response.json()["detail"] == "no preview available"


@pytest.mark.asyncio
async def test_preview_endpoint_422_on_empty_url(client) -> None:
    override_preview_deps(None)
    try:
        response = await client.get("/api/preview", params={"url": ""})
    finally:
        clear_preview_deps()

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_preview_endpoint_rate_limited(client) -> None:
    from uuid import uuid4

    from app.api.deps import get_device
    from app.core.ratelimit import build_rate_limiter
    from app.main import app
    from app.models.device import Device

    preview = LinkPreviewResponse(url="https://example.com/a", title="Example")
    override_preview_deps(preview, build_rate_limiter(1, 60, enabled=True))
    fixed_device = Device(id=uuid4(), experiment_segment=0)
    app.dependency_overrides[get_device] = lambda: fixed_device
    try:
        first = await client.get("/api/preview", params={"url": "https://example.com/a"})
        second = await client.get("/api/preview", params={"url": "https://example.com/a"})
    finally:
        clear_preview_deps()
        app.dependency_overrides.pop(get_device, None)

    assert first.status_code == 200
    assert second.status_code == 429