# vicinopoli

A localized social network with an extremely low entry threshold: open the PWA,
enter an address, optionally choose a pseudonym, and immediately post text,
voice, or photos to your neighbours. No account, no password.

## Getting started

```bash
make up           # start the full stack (PostGIS, MinIO, Caddy, backend, frontend)
make gen          # generate TypeScript API types from the backend OpenAPI schema
make test-backend # run backend tests
make test-frontend# run frontend tests
```

The PWA is served at `http://localhost:8080` (via Caddy, rootless Docker on
this machine). Backend API and docs are proxied at `http://localhost:8080/api`
and `http://localhost:8080/api/docs`.

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
