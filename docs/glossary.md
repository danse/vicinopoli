# Glossary

Human-friendly terms for **vicinopoli**, with their code names. This is the
single source of truth for concept naming: use these terms in docs, code and
the user manual, and don't introduce synonyms for the same concept.

## Product concepts

### Neighbour / vicina
Someone near you (within the feed's scope) who uses vicinopoli. A device that
recently became active shows the "nuova vicina" (new neighbour) badge.
- Code: `is_new_neighbour()`, `new_neighbour`.

### Voice / voce
The author's choice when publishing: how far the post should travel.
Four voices: `street` (la mia via), `some` (alcune vicine), `area` (il
quartiere), `city` (tutta la città). The composer defaults to `city`.
- Stored on the post (`posts.voice`), never converted at publish time.
- Code: `PostVoice`, `posts.voice`.

### Reach
The distance a post actually travels, derived from its voice:

| Voice   | Reach |
|---------|-------|
| street  | 5m    |
| some    | 500m  |
| area    | 3km   |
| city    | 50km  |

A post is visible only within its reach: a viewer sees the post when
`distance(viewer, post) <= reach`. The conversion is a fixed lookup computed
in the feed — it is not trust-derived (see Trust) and not density-derived.
`street` is a 5m *radius* (there are no street numbers yet), not a normalized
address key match.
- Code: `VOICE_TO_REACH_M` (backend), `app.services.reach`.

### Scope (feed scope) / portata del feed
How far the feed had to look to fill the page — the only *scope* in the
product, and the value behind the "Entro <x>" label. The adaptive feed widens
step by step (`SCOPE_STEPS`: 5m, 500m, 3km, 50km — the sorted voice reaches)
until it gathers `target_count` visible posts or reaches the 50km ceiling; the
step where it stopped is the feed's scope.
- API field: `effective_radius_m` (wire name kept).
- Code: `SCOPE_STEPS`, `MAX_SCOPE_M` (in `app.services.feed`).

### Adaptive feed / bacheca adattiva
The feed-building algorithm: walk the reach ladder (`SCOPE_STEPS`), collect
posts within each radius, keep those whose reach covers the viewer, stop when
`target_count` posts are gathered or at the 50km ceiling. Cold bootstrap: the
default `city` voice (50km reach) plus the widening search means two
brand-new neighbours always reach each other.
- Code: `expanding_radius_feed()` in `app.services.feed`.

### Target count / K
How many posts the feed aims to gather before widening (default 10). This is
the "K" of the reach model — a fill target, not a distance.
- API field: `target_count` (query param on `GET /api/feed`).

### Trust / fiducia
How much an unknown device can *write* in a UTC day: 3 posts as a new
neighbour, 30 once trusted (7 days, no reports). Trust gates volume only —
never reading, never reach (ADR 0022).
- Code: `daily_post_quota()`, `posts_used_today()`; API fields
  `daily_post_limit`, `posts_left_today`.

## Naming map

| Concept           | Backend                      | API field       | Frontend                  |
|-------------------|------------------------------|-----------------|---------------------------|
| Voice             | `PostVoice`, `posts.voice`   | `voice`         | `composer-voice-*`        |
| Reach             | `VOICE_TO_REACH_M`           | — (internal)    | —                         |
| Scope (feed scope)| `expanding_radius_feed()`    | `effective_radius_m` | `composer.radius`    |
| Scope ladder      | `SCOPE_STEPS`, `MAX_SCOPE_M` | —               | —                         |
| Target count      | `target_count`               | `target_count`  | —                         |
| Adaptive feed     | `app.services.feed`          | `GET /api/feed` | `feed` page               |

## Renamed and deprecated terms

| Old term                                  | Status                          | Now                          |
|-------------------------------------------|---------------------------------|------------------------------|
| `VOICE_TO_SCOPE_M` (post-side "scope")    | Renamed                         | `VOICE_TO_REACH_M` (reach)   |
| `reach_m` / `reach_for()` neighbour count | Removed                         | `VOICE_TO_REACH_M` lookup    |
| `NEIGHBOUR_K = 25`                        | Removed                         | `target_count` (fill target) |
| `search_radius_m` (viewer browse radius)  | Removed (was never wired)       | the feed scope               |
| `RADIUS_STEPS` / `MAX_RADIUS_M`           | Renamed                         | `SCOPE_STEPS` / `MAX_SCOPE_M`|
| legacy `scope` (ADR 0006 km cap)          | Deprecated (maps to voice)      | `PostScope`, `_scope_to_voice`|
| legacy `street` same-address-key gate     | Deprecated                      | `street` = 5m reach          |