# Plan

Roadmap and milestones for **vicinopoli**.

## Vision

A localized social network with an extremely low entry threshold: open the PWA,
enter an address, optionally choose a pseudonym, and immediately post text,
voice, or photos to your neighbours. No account, no password.

Initial target: Italy. Internationalisation (i18n) in place from day one
(`it` default, `en` parallel).

## Milestones

### 1. Scaffold + docs (current)

- `AGENTS.md`, `README.md`, `docs/plan.md`, `docs/decisions/` (ADRs).
- `docker-compose.yml` (PostGIS, MinIO, Caddy), `Makefile`, `Caddyfile`.
- Backend skeleton: FastAPI + Pydantic v2, Alembic, pytest.
- Frontend skeleton: Vite + React + TypeScript + Tailwind + shadcn/ui,
  `vite-plugin-pwa`, `react-i18next`.
- OpenAPI typegen pipeline (`make gen`).
- Sentry (backend + frontend) + CI workflow.

### 2. Text + radius + visibility

- Geocoding (address -> coordinates + normalized address key) behind a
  `Geocoder` interface with caching.
- `locations` + `posts` schema; create a text post.
- Expanding-radius feed honouring scope/visibility semantics.

### 3. Identity + trust + reports

- Anonymous device token (httpOnly cookie) + optional pseudonym.
- Trust ladder: reduced reach for new devices.
- Rate limiting; report state machine with auto-hide at threshold.

### 4. Voice + photos

- Browser `MediaRecorder` -> `webm/opus`; presigned uploads to MinIO.
- Photo upload with client-side resize/compression; media rendering in feed.

### 5. Heatmap + stroll mode + building scope

- H3/geohash cell aggregates served as a tile layer (PostGIS + Martin).
- MapLibre GL JS heatmap; density only, never individual pins.
- "Passeggiata" (stroll) mode: read-only browsing of other areas.
- `building` scope (same normalized address).

### 6. Hardening

- PWA offline shell + install; backups (Postgres dump + MinIO); health checks.
- Load/abuse testing; monitoring dashboards.

## Key semantics

### Visibility (asymmetric ranges)

- A post carries `scope` = author's max reach (`building`, `500m`, `1km`, `5km`).
- A viewer carries `search_radius`.
- Visibility = `distance <= scope` AND `distance <= search_radius`;
  `building` requires a matching normalized address key.

### Cold bootstrap

- Feed auto-expands radius until ~10 posts (ceiling ~50km).
- Stroll mode for read-only exploration of other areas.

### Trust ladder

- New devices can post immediately but with reduced reach until they accrue
  trust (age, no reports, engagement).
- Phone verification is a later, optional *reach* gate — never a read gate.
