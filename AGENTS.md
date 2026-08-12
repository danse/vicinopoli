# AGENTS.md

Project context and conventions for anyone (human or AI agent) working on
**vicinopoli**.

## What is vicinopoli

A localized social network with an extremely low entry threshold: open the
PWA, enter an address, optionally choose a pseudonym, and immediately post
text, voice, or photos to your neighbours. No account, no password.

## Source of truth

- `docs/plan.md` — roadmap and milestones.
- `docs/decisions/` — Architecture Decision Records (ADRs). Read these before
  making structural changes; add a new ADR for any significant decision.
- This file (`AGENTS.md`) — commands and conventions.

## Commands

All commands are run from `vicinopoli/` unless noted.

```bash
# Everything (docker): start the full stack
make up

# Stop the stack
make down

# Generate TypeScript types from the backend OpenAPI schema
make gen

# Backend
make test-backend        # run pytest
make lint-backend        # ruff + mypy

# Frontend
make test-frontend       # vitest run
make build-frontend      # vite build (also typechecks)
make lint-frontend       # eslint + tsc --noEmit

# End-to-end
make test-e2e            # Playwright against the running stack

# Format
make format
```

## Test-driven development (TDD)

- **Write the test first, watch it fail, then implement until green.** This
  applies to every change, at every level: backend (`pytest`), frontend
  (`vitest`), and user-facing flows (Playwright e2e).
- End-to-end tests live in `e2e/` and exercise the running stack through Caddy
  (`make test-e2e`). They are the source of truth for "does it actually work",
  not just "do the unit tests pass". Start features with an e2e test where a
  user-facing flow is involved.

## Conventions

### Backend (Python 3.12, FastAPI)

- Pydantic v2 models in `backend/app/schemas/` are the **single source of
  truth** for the API contract. TypeScript types are generated from them via
  OpenAPI (`make gen`) — never hand-maintain duplicate types in the frontend.
- Async SQLAlchemy 2.0 style throughout.
- Migrations via Alembic; never edit the DB by hand.
- TDD: write the test first, then the implementation. `pytest` + `pytest-asyncio`
  + `httpx`.

### Frontend (React, TypeScript, Vite)

- Tailwind CSS + shadcn/ui (Radix) components.
- All user-facing strings go through `react-i18next`; never hardcode copy.
  Italian (`it`) is the default locale, `en` is maintained in parallel.
- Generated API types live in `frontend/src/api/generated/` (produced by
  `make gen`) and are gitignored.

### General

- No emojis in code or docs unless explicitly requested.
- Never log raw addresses or exact coordinates; use geohash cells / IDs only.
- The codebase should stay docker-compose runnable: `make up` must always work.

## Environment variables

See `backend/.env.example` and `frontend/.env.example`. Secrets are never
committed.
