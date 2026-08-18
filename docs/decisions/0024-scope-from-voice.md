# 0024 — Voice stored, reach computed in the feed

- Status: accepted
- Date: 2026-08-18
- Amends: [0022-trust-as-daily-quota.md](0022-trust-as-daily-quota.md) (reach part only)
- Supersedes: the reach conversion in [0018-reach-model.md](0018-reach-model.md)
- Related: [glossary.md](../glossary.md) is the single source of truth for naming

## Context

ADR 0022 fixed the cold-start bug by making `K` a fixed constant, but reach was
still a **neighbour-count conversion recomputed per feed request**: for each
candidate post the feed walked the radius ladder counting distinct other active
posters (`reach_for`). This had two costs:

- **Performance:** a dense feed page ran one neighbour-count query per
  candidate (`_is_visible`), i.e. O(posts) reach queries per page.
- **Honesty:** the "Entro <x> km" label (`effective_radius_m`) came from the
  search window, not from the posts actually shown, and a post's distance
  depended on who happened to be around it.

We also had a naming problem: "how far a post travels" was called `reach`
(neighbour-count based), while the product's *scope* concept (ADR 0006) had
been folded into the legacy `scope` API field. Once the feed got its own honest
"how far did I look" value (`effective_radius_m`), "scope" meant two different
things. The glossary (glossary.md) settles it: **reach** is the per-post
travel distance, **scope** is the feed's search bound.

## Decision

**The post stores only its `voice`** (as today). **Reach is computed in the
feed** from the stored voice via a fixed, trust-free lookup
`VOICE_TO_REACH_M`:

| Voice   | Reach |
|---------|-------|
| street  | 5m    |
| some    | 500m  |
| area    | 3km   |
| city    | 50km  |

- The conversion is a pure lookup — **no neighbour count, no density, no
  trust**. `street` is a 5m *radius* (there are no street numbers yet), not a
  normalized-address-key match.
- The **adaptive feed** walks `SCOPE_STEPS` (the sorted voice reaches:
  5m -> 500m -> 3km -> 50km), collecting posts within each radius and keeping
  those whose reach covers the viewer (`distance <= reach`), until
  `target_count` posts are gathered or the 50km ceiling is reached.
- The feed's **scope** — `effective_radius_m` — is the ladder step where it
  stopped, so the "Entro <x>" label matches what is actually shown.
  `target_count` (= "K") is the fill target, not a distance.
- `NEIGHBOUR_K`, `reach_for`, and the dead `search_radius_m` parameter are
  removed.

## Consequences

- **Zero reach queries per feed page** — the N+1 problem and the label-accuracy
  problem both disappear. One `ST_DWithin` query per ladder step.
- Cold bootstrap holds: the composer default is `city` (50km reach), so two
  brand-new neighbours posting without touching the selector always reach each
  other; the adaptive feed still widens its search to 50km in sparse areas.
- The trust ladder (ADR 0022) is unchanged: it gates daily posting volume,
  never reach.
- Backwards compatibility: legacy km `scope` input on `POST /api/posts` still
  maps to a voice via `_scope_to_voice`; `scope` stays nullable on posts.
- Naming is aligned with the glossary: `reach` (per-post travel distance),
  `voice` (stored intent), `scope` (`effective_radius_m`, the feed's search
  bound), `target_count` (= K).