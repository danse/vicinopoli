# 0006 — Visibility and asymmetric ranges

- Status: superseded by [0018-reach-model.md](0018-reach-model.md)
- Date: 2026-08-12
- Superseded: 2026-08-14

## Context

"Who can see what" must be unambiguous when both the author and the viewer
choose a range.

## Decision (original)

- A post carries `scope` = author's max reach (`street`, `500m`, `1km`, `5km`).
- A viewer carries `search_radius` = how far they browse.
- **Visibility = `distance <= scope` AND `distance <= search_radius`.**
- `street` scope requires the viewer to resolve to the same normalized
  address key.

## Consequences

- A 5km browser never sees a 500m-scoped post from 3km away, and vice versa.
- The intersection rule is implemented in a single feed query function.

## Why superseded

The km cap created a cold-start problem (two brand-new neighbours could never
reach each other) and forced users to reason in metres. The reach model in ADR
0018 replaces the author's `scope` with `voice` (fuzzy intent) converted to a
`reach_m` distance at feed-serve time, keeping the same intersection rule for
visibility.
