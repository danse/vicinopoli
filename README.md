# vicinopoli

A localized social network with an extremely low entry threshold: open the PWA,
enter an address, optionally choose a pseudonym, and immediately post text,
voice, or photos to your neighbours. No account, no password.

## Getting started

```bash
make up           # start the full stack (PostGIS, MinIO, Caddy, backend, frontend)
make up-manual    # same, but with the real geocoder (Nominatim) for manual testing
make gen          # generate TypeScript API types from the backend OpenAPI schema
make test-backend # run backend tests
make test-frontend# run frontend tests
```

The PWA is served at `http://localhost:8080` (via Caddy, rootless Docker on
this machine). Backend API and docs are proxied at `http://localhost:8080/api`
and `http://localhost:8080/api/docs`.

## Tailing server logs

The stack runs under docker compose, so use `docker compose logs` to watch a
service — handy after `make up-manual` in a second terminal:

```bash
docker compose logs -f backend    # follow the FastAPI/uvicorn logs
docker compose logs -f frontend   # follow the Vite server logs
docker compose logs -f --tail=100 backend  # last 100 lines, no follow
```

Service names match the `docker-compose.yml` services (`backend`, `frontend`,
`db`, `minio`, `caddy`).

## Geocoding modes

`GEOCODER_MODE` selects which address geocoder the backend uses:

| Mode       | Behavior                                                                 |
|------------|--------------------------------------------------------------------------|
| `static`   | Deterministic, offline-safe lookup for a handful of hardcoded test       |
|            | addresses (e.g. `Via Roma 1, Roma`). Default for `make up`; e2e and unit |
|            | tests rely on it for repeatable results.                                 |
| `nominatim`| Real geocoding against the public Nominatim API. Used by `make up-manual`|
|            | for manual testing and by production (see `deploy/README.md`).           |

Production **must** set `GEOCODER_MODE=nominatim` — the `static` mode only
resolves test addresses, so any real address would fail to publish.

## Architecture

```
Browser (PWA: React + TypeScript + Vite)
        |  HTTPS
        v
Caddy (reverse proxy + TLS)
        |---> Backend (FastAPI, uvicorn) ---> PostGIS (Postgres 15)
        |           |                            |-- spatial + posts + identity
        |           |---> Geocoder (Nominatim public API, cached)
        |           +---> MinIO (S3) --- voice + photo blobs
        +---> Frontend static build
```

## Repository layout

```
vicinopoli/
  AGENTS.md            # context + commands for agents
  README.md
  Caddyfile            # reverse proxy + TLS
  docker-compose.yml   # full stack
  Makefile             # developer commands
  docs/
    plan.md            # roadmap + milestones
    decisions/         # ADRs
  deploy/              # production deployment (Hetzner VPS) — see deploy/README.md
  backend/             # FastAPI + Pydantic + SQLAlchemy + Alembic
  frontend/            # Vite + React + Tailwind + shadcn/ui + PWA
  openapi/             # generated TS types (gitignored)
```

## Decisions

See `docs/decisions/` for Architecture Decision Records (ADRs). Key choices:

- Pydantic v2 models are the single source of truth for the API; TS types are
  generated via OpenAPI.
- PostGIS (`geography` type, GiST, `ST_DWithin`) for geospatial queries.
- Anonymous device tokens + optional pseudonym, no login; a trust ladder gives
  new devices reduced reach.
- Tailwind CSS + shadcn/ui for styling; Italian (`it`) default locale with `en`.

## Deployment

See [`deploy/README.md`](deploy/README.md) for running the production stack on a
Hetzner VPS (self-contained `docker-compose.prod.yml`, Caddy with Let's Encrypt
TLS).
