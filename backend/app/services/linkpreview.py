"""Link-preview resolution (ADR 0028).

A privacy-friendly proxy: the backend fetches oEmbed/OpenGraph metadata on
behalf of the viewer so the browser never talks to third parties directly. Only
extracted text fields are returned — never raw HTML — and outbound requests are
guarded against SSRF (no private/loopback targets).
"""

import ipaddress
import socket
import time
from dataclasses import dataclass
from html.parser import HTMLParser
from urllib.parse import quote, urljoin, urlparse

import httpx

from app.schemas.linkpreview import LinkPreviewResponse

_BROWSER_UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120 Safari/537.36 vicinopoli/0.1"
)

# Hosts that answer the no-auth oEmbed API (verified 2026-08-20), mapped to the
# oEmbed endpoint. Everything else falls back to OpenGraph scraping.
_OEMBED_PROVIDERS: tuple[tuple[tuple[str, ...], str], ...] = (
    (
        ("youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"),
        "https://www.youtube.com/oembed",
    ),
    (
        ("soundcloud.com", "www.soundcloud.com", "m.soundcloud.com", "on.soundcloud.com"),
        "https://soundcloud.com/oembed",
    ),
    (
        ("reddit.com", "www.reddit.com", "old.reddit.com", "new.reddit.com"),
        "https://www.reddit.com/oembed",
    ),
)

_MAX_BODY_BYTES = 2_000_000
_MAX_TEXT_CHARS = 500


class _MetaParser(HTMLParser):
    """Extract OpenGraph properties, named metas and the <title> from a page."""

    def __init__(self) -> None:
        super().__init__()
        self.og: dict[str, str] = {}
        self.meta: dict[str, str] = {}
        self.title: str | None = None
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_dict = dict(attrs)
        if tag == "meta":
            content = attr_dict.get("content")
            if content is None:
                return
            prop = attr_dict.get("property")
            name = attr_dict.get("name")
            if prop:
                self.og[prop.strip().lower()] = content
            elif name:
                self.meta[name.strip().lower()] = content
        elif tag == "title":
            self._in_title = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title and self.title is None:
            self.title = data.strip()


def _clean_text(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    text = " ".join(value.split())
    if text == "":
        return None
    return text[:_MAX_TEXT_CHARS]


def _clean_image_url(value: object, base: str | None = None) -> str | None:
    if not isinstance(value, str):
        return None
    url = value.strip().strip('"')
    if base is not None:
        url = urljoin(base, url)
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return None
    return url


def _blocked_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def _host_allowed(host: str) -> bool:
    """SSRF guard: block any host that could reach internal networks."""
    try:
        literal = host.split("%")[0]
        ip = ipaddress.ip_address(literal)
    except ValueError:
        pass
    else:
        return not _blocked_ip(ip)
    try:
        infos = socket.getaddrinfo(host, 80, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        return False
    resolved = [str(info[4][0]).split("%")[0] for info in infos]
    return not any(_blocked_ip(ipaddress.ip_address(addr)) for addr in resolved)


@dataclass
class LinkPreviewFetcher:
    timeout: float = 10.0
    ttl_seconds: int = 3600

    def __post_init__(self) -> None:
        self._cache: dict[str, tuple[float, LinkPreviewResponse]] = {}
        self._client = httpx.AsyncClient(
            headers={"User-Agent": _BROWSER_UA},
            timeout=self.timeout,
            follow_redirects=True,
            limits=httpx.Limits(max_connections=10),
        )

    async def _fetch(self, url: str) -> httpx.Response:
        response = await self._client.get(url)
        response.raise_for_status()
        return response

    async def preview(self, url: str) -> LinkPreviewResponse | None:
        cleaned = self._clean_url(url)
        if cleaned is None:
            return None
        hit = self._cache.get(cleaned)
        if hit is not None and hit[0] > time.monotonic():
            return hit[1]
        result = await self._resolve(cleaned)
        if result is not None:
            self._cache[cleaned] = (time.monotonic() + self.ttl_seconds, result)
        return result

    @staticmethod
    def _clean_url(url: str) -> str | None:
        parsed = urlparse(url.strip())
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            return None
        return url.strip()

    async def _resolve(self, url: str) -> LinkPreviewResponse | None:
        parsed = urlparse(url)
        if not parsed.hostname or not _host_allowed(parsed.hostname):
            return None
        endpoint = _oembed_endpoint(parsed.hostname)
        if endpoint is not None:
            try:
                response = await self._fetch(
                    f"{endpoint}?url={quote(url, safe='')}&format=json"
                )
            except (httpx.HTTPStatusError, httpx.RequestError):
                return None
            return _from_oembed(response, url)
        try:
            response = await self._fetch(url)
        except (httpx.HTTPStatusError, httpx.RequestError):
            return None
        return _from_html(response, url)


def _oembed_endpoint(host: str) -> str | None:
    for hosts, endpoint in _OEMBED_PROVIDERS:
        if host in hosts:
            return endpoint
    return None


def _from_oembed(response: httpx.Response, url: str) -> LinkPreviewResponse | None:
    try:
        data = response.json()
    except ValueError:
        return None
    if not isinstance(data, dict):
        return None
    return LinkPreviewResponse(
        url=url,
        title=_clean_text(data.get("title")),
        description=_clean_text(data.get("description")),
        image_url=_clean_image_url(data.get("thumbnail_url")),
        provider_name=_clean_text(data.get("author_name") or data.get("provider_name")),
        provider_url=_clean_image_url(data.get("author_url") or data.get("provider_url")),
        type=_clean_text(data.get("type")),
    )


def _from_html(response: httpx.Response, url: str) -> LinkPreviewResponse | None:
    content = response.content
    if len(content) > _MAX_BODY_BYTES:
        content = content[:_MAX_BODY_BYTES]
    parser = _MetaParser()
    parser.feed(content.decode("utf-8", errors="replace"))
    title = _clean_text(parser.og.get("og:title")) or parser.title
    if title is None:
        return None
    return LinkPreviewResponse(
        url=url,
        title=title,
        description=_clean_text(parser.og.get("og:description") or parser.meta.get("description")),
        image_url=_clean_image_url(parser.og.get("og:image"), base=url),
        provider_name=_clean_text(parser.og.get("og:site_name")),
        provider_url=None,
        type=_clean_text(parser.og.get("og:type")),
    )