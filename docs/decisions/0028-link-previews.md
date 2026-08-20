# 0028 — Link previews

- Status: accepted
- Date: 2026-08-20

## Context

Post bodies are plain text; URLs in them are inert. The roadmap asks for
"rendering of links and previews from youtube, instagram, facebook, twitter,
reddit, soundcloud etcetera". Two constraints shape the design:

- **Privacy:** vicinopoli never leaks the viewer's IP or exact coordinates. If
  the browser fetched previews directly, every third-party site would see the
  viewer's address and browser. Previews must be fetched server-side.
- **Platform reality:** a generic OpenGraph scraper alone does not work for the
  listed platforms — Instagram and Facebook serve login/consent walls without
  `og:` tags to non-browser clients, Twitter/X returns only generic fallback
  tags, and Reddit blocks plain scrapers (403). By contrast, YouTube, SoundCloud
  and Reddit all expose no-auth oEmbed endpoints that return clean JSON.

## Decision

A backend proxy endpoint `GET /api/preview?url=...` resolves previews on the
viewer's behalf:

- **Provider registry:** known platforms with no-auth oEmbed endpoints
  (YouTube incl. `youtu.be`, SoundCloud, Reddit) are queried first. Only
  `title`, `description`, `thumbnail_url`, provider and type are extracted —
  the oEmbed `html` field is **never** forwarded (it would embed untrusted
  iframes/scripts in the feed).
- **Generic fallback:** any other `http(s)` URL is fetched with a browser-like
  User-Agent and parsed for OpenGraph tags (`og:title`, `og:description`,
  `og:image`, `og:site_name`), falling back to `<title>` and the `description`
  meta tag. `og:image` is resolved to absolute and must be `http(s)`.
- **SSRF guard:** before any request, the target host is resolved and blocked if
  any resolved IP is private, loopback, link-local, reserved, multicast or
  unspecified. Non-`http(s)` schemes are rejected.
- **Abuse controls:** a per-device rate limit (default 30/min) and an in-memory
  TTL cache (default 1 h) for successful results. Failures degrade to
  `404 no preview available` and the client hides the card.

The client renders a preview card for the **first** URL found in a post body,
fetched lazily via the proxy; that same URL becomes a clickable link in the
text. Cards are never rendered from raw HTML.

## Consequences

- Viewers' IPs stay private: only the backend talks to third parties.
- Instagram/Facebook/X posts degrade to a title-only card or nothing — the
  generic fallback simply won't find usable metadata for them, which is the
  honest outcome given their bot walls.
- A new outbound network surface for the backend; mitigated by the SSRF guard,
  rate limit, cache and 404-on-failure.
- No new frontend dependency: URL detection is a small regex; previews render
  with plain Tailwind.