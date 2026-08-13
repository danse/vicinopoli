# 0014 — Experiments foundation

- Status: accepted
- Date: 2026-08-13

## Context

Milestone 4 needs a feature-flag layer and a basis for future A/B tests, plus
privacy-safe product analytics from day one. We have no accounts, so the only
stable identity is the anonymous device token (ADR 0005).

## Decision

- **Segment:** each device is assigned a stable deterministic `experiment_segment`
  (0..99) derived from its id. Feature flags are functions of the segment,
  returned to the client as `experiment_flags`.
- **Events:** a single `analytics_events` table stores privacy-safe rows:
  device id, event `name`, created_at, and only coarse context (geohash cell,
  post id) — never raw addresses or coordinates.
- **Consent gate:** nothing is collected until the device opts in. The GDPR
  consent choice lives on the device (`analytics_consent`); events are dropped
  server-side when consent is missing or declined. There is no client-side
  "server said no" — the server enforces it.
- **Client contract:** `POST /api/events` accepts
  `post_viewed`, `post_created`, `onboarding_completed`.

## Consequences

- `DeviceResponse` exposes `experiment_segment`, `experiment_flags`, and
  `analytics_consent` so the frontend can render the consent banner and gate
  UI behind flags.
- Events are best-effort: the endpoint returns 202 and never blocks the user
  flow.
- A/B tooling proper is deferred until there is real usage to measure.