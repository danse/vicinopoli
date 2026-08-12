# 0006 — Visibility and asymmetric ranges

- Status: accepted
- Date: 2026-08-12

## Context

"Who can see what" must be unambiguous when both the author and the viewer
choose a range.

## Decision

- A post carries `scope` = author's max reach (`building`, `500m`, `1km`, `5km`).
- A viewer carries `search_radius` = how far they browse.
- **Visibility = `distance <= scope` AND `distance <= search_radius`.**
- `building` scope requires the viewer to resolve to the same normalized
  address key.

## Consequences

- A 5km browser never sees a 500m-scoped post from 3km away, and vice versa.
- The intersection rule is implemented in a single feed query function.
