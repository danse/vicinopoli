# 0017 — Hardening: health checks, load/abuse, monitoring

- Status: accepted
- Date: 2026-08-13

## Context

Milestone 6 (hardening) needs operational visibility: a readiness signal that
reflects real dependencies, per-service healthchecks, protection against
abusive bursts, and a way to observe traffic. ADR 0012 deferred
Prometheus/Grafana "later"; this ADR brings the data source forward as an
opt-in stack.

## Decision

- **Guarded `/readyz`** probes the database (`SELECT 1`) and the object store
  (configured bucket exists) via `app/services/readiness.py`. Each probe
  returns a boolean and never raises; the endpoint returns 200 only when every
  probe passes, otherwise 503 with per-dependency results.
- **Docker healthchecks** on every service: `pg_isready` (db), MinIO
  `/minio/health/live`, backend `GET /healthz`, nginx and Caddy `wget` probes.
  Services start in dependency order only after their dependencies are
  healthy.
- **Load/abuse testing** lives in the e2e suite (`hardening.spec.ts`):
  concurrent feed load must stay 200, and a single device posting in a burst
  must hit the per-device rate limit (429).
- **Monitoring**:
  - Backend exposes `GET /metrics` (Prometheus text format) via
    `prometheus-client`, recording per-route request counts and latencies.
    Metrics carry no PII (no addresses, coordinates, or device ids).
  - Prometheus + Grafana run under an opt-in compose profile (`make
    monitoring`), wired to scrape `backend:8000/metrics`, with a provisioned
    datasource and a minimal dashboard.

## Consequences

- `make up` stays lean; `make monitoring` adds the observability stack.
- `/readyz` now depends on MinIO being up, so the app no longer reports ready
  while uploads would fail.
- Rate-limit abuse and readiness are covered end-to-end by Playwright specs;
  the monitoring scrape is verified by the `/metrics` e2e check.