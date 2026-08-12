# 0002 — Platform and stack

- Status: accepted
- Date: 2026-08-12

## Context

We need to choose the product form and the backend/frontend technologies.

## Decision

- **Form:** Progressive Web App (PWA) — one web codebase, no app store, lowest
  barrier to entry.
- **Frontend:** React + TypeScript + Vite, with `vite-plugin-pwa`.
- **Backend:** Python 3.12 + FastAPI + Pydantic v2 + async SQLAlchemy 2.0.
- **Spatial:** PostGIS (`geography` type, GiST index, `ST_DWithin`).
- **Geocoding:** public Nominatim behind a `Geocoder` interface with response
  caching; Photon is a drop-in self-hosted swap later.
- **Media:** MinIO (S3-compatible) via presigned URLs.
- **Deployment:** self-hosted via `docker-compose` (PostGIS, MinIO, Caddy,
  backend, frontend).

## Consequences

- `make up` must always run the full stack.
- A `Geocoder` abstraction avoids coupling to Nominatim.
- Media blobs never flow through the API server.
