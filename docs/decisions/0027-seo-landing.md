# 0027 — Landing-page SEO

- Status: accepted
- Date: 2026-08-19

## Context

The site is a client-rendered SPA whose only publicly crawlable pages are the
landing (`/` → `/address`) and `/support`; `/feed` and `/composer` redirect
to the address page until an address is entered. Post content is geohash-scoped
and privacy-sensitive (ADR 0004, 0014): raw addresses and exact coordinates
are never logged or served. "Search engine optimisation" (plan) must not
contradict that.

## Decision

- **Landing/brand SEO only.** Static metadata in `frontend/index.html`
  (`lang="it"`): title, meta description, canonical + `og:url` from
  `VITE_PUBLIC_BASE_URL`, Open Graph (it_IT + en_US alternate), Twitter card,
  and JSON-LD `WebSite` + `Organization`. Posts are deliberately never
  indexed.
- **Real on-page text instead of a `keywords` meta tag** (which search engines
  ignore): a short bilingual intro paragraph on the address page gives crawlers
  actual content.
- **`robots.txt`** allows crawling but disallows `/api/`; **`sitemap.xml**`
  lists `/` and `/support`.
- Per-route `document.title` (i18n) so tabs read page names; the default
  Italian `index.html` targets the Italian market (initial target).
- No `hreflang` links: `it`/`en` share a single URL, switched client-side.

## Consequences

- Google can index the brand/landing and the support page, but no local posts
  leak into search results.
- SERP snippets come from the static Italian description; in-app copy stays
  bilingual.
- No runtime/backend change: everything is build-time static assets plus a
  small client-side title effect.