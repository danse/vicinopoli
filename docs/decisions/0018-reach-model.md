# 0018 — Reach model (voice / trust cap / reach_m)

- Status: accepted
- Date: 2026-08-14
- Supersedes: [0006-visibility-scopes.md](0006-visibility-scopes.md),
  [0007-cold-bootstrap.md](0007-cold-bootstrap.md)

## Context

The old `scope` (km cap) had a cold-start problem: two brand-new neighbours,
each capped to a small radius, could never see each other, so the product felt
dead before it grew. We also forced users to think in metres. We want the
author to express *fuzzy intent* and the system to guarantee that low-trust
users always connect to their immediate neighbours, no matter how sparse the
area.

## Decision

Three concepts, never conflated:

- **Voice** = the author's fuzzy intent about how far the post should travel,
  chosen in the composer: `building` | `some` | `area` | `city`. Default is
  `city`.
- **Trust cap `K`** = how many distinct *other* active posters a post may
  reach. `UNTRUSTED_K = 1`, `TRUSTED_K = 25`. The author's own device is
  excluded from the count.
- **Reach `reach_m`** = the distance a post actually travels, converted from
  voice + trust cap **per feed request** (not frozen at publish).

Conversion:

- `building` voice -> `reach_m = 0` (visible only to the same normalized
  address key).
- Otherwise `reach_m` = the smallest radius stepping through
  `500m -> 1km -> 5km -> 20km -> 50km` that contains at least `K` distinct
  other active posters relative to the post's location.
- If fewer than `K` other active posters exist anywhere, `reach_m = 50km`
  (honesty in sparse areas: don't silently hide the post).

Visibility stays distance-based (conversion layer preserving the semantic of
ADR 0006):

- **Visibility = `distance <= reach_m` AND `distance <= search_radius`.**

## Consequences

- Backwards compatibility: `scope` is kept nullable on posts; new posts write
  `voice`; legacy km `scope` values map to a voice (`building`->`building`,
  `5km`->`area`, else `some`) via `_scope_to_voice`.
- Reach is recomputed when a feed page is served, so an old post's effective
  radius drifts as area density and author trust change. This is intentional
  at the current scale and must be revisited for scalability (see plan.md).
- The neighbour scan happens per feed request; fine for few users, a known
  scalability concern later.
- The trust ladder in ADR 0005 now gates on `K` rather than a km cap.
