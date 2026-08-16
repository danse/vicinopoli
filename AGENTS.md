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
# ALWAYS use `make gen`. Never hand-run the backend export in `backend/` and
# `npm run gen:types` in `frontend/` as separate ad-hoc commands unless `make
# gen` itself is broken; if it fails, suspect a stale Docker daemon first
# (restart the rootless daemon, `docker compose up -d --build backend`) rather
# than the script.
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

# Coverage (backend 89%, frontend ~88% at time of writing)
make coverage            # both reports
make coverage-backend    # pytest-cov, HTML in backend/htmlcov/, .coverage
make coverage-frontend   # vitest --coverage (v8), HTML in frontend/coverage/

# Format
make format
```

## Test-driven development (TDD)

- **Write the test first, watch it fail, then implement until green.** This
  applies to every change, at every level.
- End-to-end tests live in `e2e/` and exercise the running stack through Caddy
  (`make test-e2e`). They are the source of truth for "does it actually work",
  not just "do the unit tests pass".
- **Order matters for user-facing features:** write the Playwright e2e spec
  *first* (watch it fail for the right reason), then the unit tests (backend and
  frontend) for each piece, then implement until all of them are green. A
  feature is not done until its e2e spec passes against the rebuilt stack.
- Implement and verify against the *running* stack (`make up`), not the source
  tree: rebuild containers after frontend/backend changes before running e2e.

## Stale artifacts: check before you trust

Recurring failure mode: tests or e2e run against **stale** code. Before
debugging, verify each layer is actually running what was just changed:

- **Containers** — `docker compose up -d --build <svc>` only recreates services
  whose images changed. Config-only edits (e.g. `Caddyfile`, env) do **not**
  rebuild images, and `make up` may not pick them up. Use
  `docker compose up -d --force-recreate caddy` (or the affected svc) after
  editing mounted config, and confirm uptime with
  `docker compose ps --format "{{.Name}} {{.Status}}"`.
- **Types** — `frontend/src/api/generated/` comes from `make gen`. When the
  backend schemas or routes change, run `make gen`; TypeScript errors about
  missing fields usually mean stale generated types, not a frontend bug.
- **Docker image rebuilds** — the backend and frontend `Dockerfile`s copy the
  source at build time. After any `backend/` or `frontend/` source change, the
  container must be rebuilt (`docker compose up -d --build backend frontend`)
  before e2e can reflect it.
- **Migrations** — schema changes need `make migrate` (Alembic) on the running
  DB; tests use a separate database built from models, so a passing pytest does
  not mean the dev DB has the new columns.
- **Rule of thumb:** when a test fails in a way that contradicts fresh code,
  suspect staleness first and rebuild/regenerate before touching source.

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
- **Gendered words (it locale):** when a word has to be gendered in Italian,
  always use the feminine form (e.g. "vicina", "la prima", "anonima", "alguien"
  → "alcune"). Apply to existing localisations and to all new copy.
- Generated API types live in `frontend/src/api/generated/` (produced by
  `make gen`) and are gitignored.
- **No `console.log` troubleshooting.** When a test fails in a confusing way,
  don't sprinkle logs — refactor and write finer-grained tests instead (a
  single assertion per concern, at the smallest unit you can test directly).
- **Never query UI tests by copy/label text** — copy changes silently break
  tests. Use stable `data-testid` attributes (e.g. `composer-address`,
  `composer-voice-building`) instead of `getByLabelText`/`getByRole`/`getByText`
  for anything whose string is user-facing and localized. Keep `data-testid`
  values short, kebab-case, and unique per component.

### General

- No emojis in code or docs unless explicitly requested.
- Never log raw addresses or exact coordinates; use geohash cells / IDs only.
- The codebase should stay docker-compose runnable: `make up` must always work.

## Environment variables

See `backend/.env.example` and `frontend/.env.example`. Secrets are never
committed.

## Deployments

- **The human runs deployments, never the agent.** Prepare and verify everything
  locally (configs, `deploy/.env.prod`, images, tests), but do not rsync/ssh to
  the VPS or run `deploy/manual.dot` / `setup-vps.sh` / `deploy.sh`. Hand off
  with a short summary of what changed and what to run.
