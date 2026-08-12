# 0011 — Testing strategy (TDD)

- Status: accepted
- Date: 2026-08-12

## Context

We want a test-driven approach.

## Decision

- **Backend:** `pytest` + `pytest-asyncio` + `httpx` (FastAPI TestClient) against
  a PostGIS test database in docker; `factory_boy`/`polyfactory` fixtures.
  Test-first on tricky logic: geocoding/address normalization, scope-visibility
  rules, feed radius queries, trust ladder.
- **Frontend:** `Vitest` + React Testing Library for components/hooks,
  `Playwright` for end-to-end flows.
- CI runs backend + frontend unit tests and e2e against `docker compose up`.

## Consequences

- Tests are written before implementation in feature work.
- The test database must be a real PostGIS instance, not SQLite.
