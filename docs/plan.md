# Plan

Roadmap and todos for **vicinopoli**.

## Vision

A localized social network with an extremely low entry threshold: open the PWA,
enter an address, optionally choose a pseudonym, and immediately post text,
voice, or photos to your neighbours. No account, no password.

Initial target: Italy. Internationalisation (i18n) in place from day one
(`it` default, `en` parallel).

## Key semantics

Concept naming is the project's single source of truth in
[glossary.md](glossary.md) — use those terms everywhere and don't introduce
synonyms. The essentials:

### Reach model (see glossary: voice, reach, scope)

- **Voice** is stored on the post as-is: `street` | `some` | `area` | `city`
  (the composer's fuzzy intent, default `city`).
- **Reach** is the distance a post travels, converted in the feed from the
  stored voice via the fixed `VOICE_TO_REACH_M`: `street -> 5m`,
  `some -> 500m`, `area -> 3km`, `city -> 50km`. It is trust-free and
  density-free (ADR 0024; trust gates daily volume instead, ADR 0022).
- The **adaptive feed** walks `SCOPE_STEPS` (5m -> 500m -> 3km -> 50km),
  keeping posts whose reach covers the viewer, until `target_count` posts are
  gathered or the 50km ceiling; **scope** is the step where it stopped —
  `effective_radius_m` — so the "Entro <x>" label is honest. `target_count`
  (= K) is a fill target, not a distance.

### Cold bootstrap

- Feed auto-expands radius until ~10 posts (ceiling ~50km).
- Because reach comes from the voice (`city` = 50km, the composer default) and
  the feed auto-expands in sparse areas, two brand-new neighbours always reach
  each other (auto-expanding to 50km if sparse), which resolves the
  cold-start problem without a km-cap or a trust cap.

### Trust ladder (daily posting quota)

- Trust gates **how much an unknown device can write**, not how far its posts
  travel (ADR 0022).
- `UNTRUSTED_DAILY_POSTS = 3`, `TRUSTED_DAILY_POSTS = 30` per UTC day, counted
  on the device's posts in the DB (survives restarts); the limit is exposed on
  `/api/me` and the create-post response and shown in the composer.
- Trust accrual unchanged: a device becomes trusted by age (7 days, no reports,
  engagement). Phone verification is a later, optional gate — never a read gate.

## To do

Ordered by priority, remove from the list when done



- rendering of links and previews from youtube, instagram, facebook, twitter, reddit, soundcloud etcetera
- link from the composer to the feed
- realtime feed
- message page, navigate on click. Image shows full-screen in there
- post removal
- post editing: should happen within a time window
- account page
- re-enable the feed heatmap
- denial of service surface with changing device id, like we do in pagination tests

- remove google tag for privacy
- equalise
- replies and threading user experience
- send a notification upon a reply
- address geocoded on the client and shown on map with the reach (unsure whether on the address page or post page)
- distance user experience: colour-code post cards by distance band and/or a small proximity visualisation (rings/intensity), as a future enhancement
- self-hosted photon
- monetization scheme, report commercial/advertisement/business
- add arabic
- diffusione

- crowfunding campaign

- street numbers
- content-spike detection with address
- blind accessibility test for audio content workflows
