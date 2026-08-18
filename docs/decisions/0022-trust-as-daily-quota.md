# 0022 — Trust gates posting volume, not reach

- Status: accepted
- Date: 2026-08-17
- Supersedes: [0018-reach-model.md](0018-reach-model.md)
- Amended: 2026-08-18 by [0024-scope-from-voice.md](0024-scope-from-voice.md)
  (the reach/neighbour-count conversion is replaced by a fixed voice->reach
  lookup; the daily posting quota is untouched)

## Context

The reach model (ADR 0018) folded the trust ladder into the reach conversion:
`reach_m` became "the smallest radius containing `K = neighbour_cap(author)`
other active posters", with `UNTRUSTED_K = 1` and `TRUSTED_K = 25`. The intent
was a cold-start guarantee — two brand-new neighbours must always read each
other — but the mechanism only delivers that in a truly empty area:

- `K = 1` means reach = the radius of the author's *nearest* other poster.
- Add one closer poster (a test/verification post on the same street) and a
  new author's reach collapses to the 500m step, hiding a real new neighbour
  who is farther away but well within 50km.
- Visibility is then asymmetric (A sees B, B does not see A), and the feed UI
  reports `effective_radius_m` = 50km ("Entro 50 km") for posts it never shows.

In production this surfaced as two brand-new neighbours in Ragusa (~24km apart)
who could not read each other even though the whole city had only a couple of
users.

The deeper problem is a category error: **reach should be a simple, honest,
easily-presented property of the post; trust should gate the abuse vector.**
Applying trust to reach makes reach impossible to present faithfully.

## Decision

Separate the two concerns entirely.

### Reach: simple, trust-free

Reach keeps the neighbour-count conversion but with a **single fixed `K`** for
every author — no trust dependence:

- `street` voice -> `reach_m = 0` (visible only to the same normalized address
  key).
- Otherwise `reach_m` = the smallest radius walking
  `500m -> 1km -> 5km -> 20km -> 50km` that contains at least `K = 25`
  distinct *other* active posters relative to the post's location.
- If fewer than `K` others exist anywhere, `reach_m = 50km` (sparse-area
  honesty).

Because `K` is a fixed constant, two brand-new neighbours in a sparse area
always spread to the 50km ceiling and always see each other — the cold-bootstrap
guarantee holds regardless of trust. In a dense area the ladder stops at the
first radius holding 25 other active posters, which is an honest "a real
community" bound.

### Trust ladder: transparent daily posting quota

Trust now gates the only thing it should at this scale — how much an unknown
device can write:

- `UNTRUSTED_DAILY_POSTS = 3` — a brand-new device may publish up to 3 posts
  per day.
- `TRUSTED_DAILY_POSTS = 30` — after accruing trust (7 days, ADR 0005) the
  limit rises to 30 per day.

The quota is enforced at publish time (count of the device's posts in the
current UTC day) and surfaced to the user: `/api/me` and the create-post
response expose `daily_post_limit` and `posts_left_today`, and the composer
shows "ti restano N post oggi" with a short helper explaining that the limit
rises as the device earns trust. This is deliberately transparent — unlike the
opaque API rate limiter, which stays in place purely as an abuse/DoS guard.

## Consequences

- Two brand-new neighbours always read each other up to 50km (cold bootstrap),
  independent of trust — fixes the production Ragusa case.
- The trust ladder is now a single, user-facing, explainable number instead of
  a hidden distance that contradicts the "Entro 50 km" label.
- Reach is a pure function of the post + live area density, recomputed per feed
  request exactly as before (ADR 0018); only the `K` input is no longer
  trust-derived.
- The API rate limiter (`POST_RATE_LIMIT_PER_MINUTE`) is unchanged and remains
  an internal abuse guard; it is not presented to users.
- Daily-quota counting uses the DB (`posts.created_at`), so it survives
  restarts and is cheap enough at this scale.
- ADR 0005's trust accrual (device age) is unchanged; only the effect of being
  untrusted changes (fewer daily posts, not less reach).