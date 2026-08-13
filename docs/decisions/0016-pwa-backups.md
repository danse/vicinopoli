# 0016 — PWA installation and backups

- Status: accepted
- Date: 2026-08-13

## Context

Milestone 6 (hardening) requires an installable, offline-capable PWA and
recoverable backups. Vite's `vite-plugin-pwa` already emitted a service worker
and precache, but the manifest had no icons (so install was impossible) and no
offline navigation fallback. No backup path existed for Postgres or MinIO.

## Decision

- **Installable PWA.** Add PNG icons (192, 512, plus a `maskable` variant) to
  the manifest, wire `registerType: "autoUpdate"` + `injectRegister: "auto"`,
  add `navigateFallback: /index.html` so SPA routes load offline, and add
  apple-touch metadata. Densities as a service worker: After a visit, the app
  shell (JS/CSS/HTML) is readable offline.
- **Backups = Postgres dump + MinIO mirror**, produced by `scripts/backup.sh`
  into `backups/<UTC timestamp>/` (`make backup`). The backend container bind
  mounts `./backups` at `/backups` so the `pg_dump` stream and the object-store
  mirror both land on the host.
  - `postgres.dump` — `pg_dump` custom format (restore with `pg_restore --clean`).
  - `media/` — a mirror of the MinIO bucket via `scripts/backup_minio.py`
    (SDK-powered, uses existing app settings for credentials).
- Backups are scheduled by the operator (e.g. cron); no scheduler is bundled.

## Consequences

- `vite-plugin-pwa` manifest/icons live in `frontend/` and are rebuilt by the
  existing frontend image.
- `backups/` is gitignored; credentials come from backend env, never the repo.
- The e2e suite verifies both: PWA installability/offline, and that `make
  backup` produces non-empty dump + media mirror through the running stack.