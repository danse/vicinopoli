# 0007 — Cold bootstrap

- Status: accepted
- Date: 2026-08-12

## Context

When a user has no neighbours nearby, the feed would be empty and the product
would feel dead.

## Decision

- **Expanding radius:** widen from `500m` -> `1km` -> `5km` -> `20km` until the
  feed has ~10 posts (hard ceiling ~50km), always showing the current radius.
- **Stroll mode ("passeggiata"):** read-only browsing of other neighbourhoods
  and cities via the map.

## Consequences

- The feed endpoint accepts a target count and returns the effective radius.
- Stroll mode is a read-only exploration surface, distinct from the local feed.
