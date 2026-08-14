# 0012 — Monitoring and observability

- Status: accepted
- Date: 2026-08-12

## Context

We need error tracking and health visibility without leaking PII.

## Decision

- **Sentry** (`sentry-sdk` for Python, `@sentry/react` for the frontend), SaaS
  for the MVP; a self-hosted GlitchTip is the on-prem alternative.
- `structlog` structured logging; `/healthz` + `/readyz` endpoints; Docker
  healthchecks.
- **Prometheus/Grafana (opted-in via the `monitoring` compose profile):** the
  backend exposes `vicinopoli_*` metrics on `/metrics` (prometheus_client); a
  Prometheus container scrapes `backend:8000/metrics`; Grafana serves a
  provisioned dashboard (`monitoring/grafana/dashboards/vicinopoli.json`) with
  a provisioned Prometheus datasource. The datasource and the dashboard panels
  both use `uid: prometheus` — keep them in sync (a mismatch silently shows
  empty panels).
- **Privacy:** never send raw addresses or exact coordinates to Sentry — only
  geohash cells and error context. Metrics are counts and durations only.

## Consequences

- `SENTRY_DSN` is a secret, never committed (see `.env.example`).
- Logging helpers strip/geohash location fields.
