# 0007 — Cold bootstrap

- Status: superseded by [0018-reach-model.md](0018-reach-model.md)
- Date: 2026-08-12
- Superseded: 2026-08-14

## Context

When a user has no neighbours nearby, the feed would be empty and the product
would feel dead.

## Decision (original)

- **Expanding radius:** widen from `500m` -> `1km` -> `5km` -> `20km` until the
  feed has ~10 posts (hard ceiling ~50km), always showing the current radius.
- **Stroll mode ("passeggiata"):** read-only browsing of other neighbourhoods
  and cities via the map.

## Consequences

- The feed endpoint accepts a target count and returns the effective radius.
- Stroll mode is a read-only exploration surface, distinct from the local feed.

## Why superseded

The expanding-radius loop kept two brand-new neighbours apart. Under the reach
model (ADR 0018) the author's `voice` is converted to a `reach_m` distance at
feed-serve time, so the radius used for a given post is derived from how many
neighbours the author may reach (`K`), never frozen at publish time. Stroll
mode remains on the map.
