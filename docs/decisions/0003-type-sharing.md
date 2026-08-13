# 0003 — Type sharing between backend and frontend

- Status: accepted
- Date: 2026-08-12

## Context

The backend is Python, the frontend TypeScript. We need one source of truth for
the API contract and typed clients on the frontend.

## Decision

- Pydantic v2 models (in `backend/app/schemas/`) are the single source of truth.
- FastAPI auto-generates an OpenAPI 3.1 schema.
- `openapi-typescript` (or an equivalent) generates TypeScript types/clients into
  `frontend/src/api/generated/`, driven by `make gen`.
- The OpenAPI snapshot (`openapi/openapi.json`) **is committed**; the generated
  TS types are gitignored and are **regenerated at build time** (frontend Docker
  image, CI) from the committed snapshot.

## Consequences

- Never hand-maintain duplicate TS types.
- Contract changes must happen in the Pydantic models, then be regenerated.
- CI verifies the committed `openapi/openapi.json` matches the live backend
  schema (`make gen` / drift check), so a stale snapshot fails the build instead
  of silently drifting. The frontend image is fully self-contained for a fresh
  clone: it derives `schema.d.ts` from the committed schema at build time.
