# 0012 — Monitoring and observability

- Status: accepted
- Date: 2026-08-12

## Context

We need error tracking and health visibility without leaking PII.

## Decision

- **Sentry** (`sentry-sdk` for Python, `@sentry/react` for the frontend), SaaS
  for the MVP; a self-hosted GlitchTip is the on-prem alternative.
- `structlog` structured logging; `/healthz` + `/readyz` endpoints; Docker
  healthchecks. Prometheus/Grafana later.
- **Privacy:** never send raw addresses or exact coordinates to Sentry — only
  geohash cells and error context.

## Consequences

- `SENTRY_DSN` is a secret, never committed (see `.env.example`).
- Logging helpers strip/geohash location fields.
