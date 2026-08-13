# Plan

Roadmap and milestones for **vicinopoli**.

## Vision

A localized social network with an extremely low entry threshold: open the PWA,
enter an address, optionally choose a pseudonym, and immediately post text,
voice, or photos to your neighbours. No account, no password.

Initial target: Italy. Internationalisation (i18n) in place from day one
(`it` default, `en` parallel).

## Milestones

### 4. Voice + photos

- Browser `MediaRecorder` -> `webm/opus`; presigned uploads to MinIO.
- Photo upload with client-side resize/compression; media rendering in feed.
- Experiment foundation: feature-flag layer (`experiment` segment on the device
  token) + privacy-safe event collection (`post_viewed`, `post_created`,
  `onboarding_completed`), with GDPR consent built in. A/B tooling proper is
  deferred until there is real usage to measure.

### 5. Heatmap + building scope

- H3/geohash cell aggregates served as a tile layer (PostGIS + Martin).
- MapLibre GL JS heatmap; density only, never individual pins.
- `building` scope (same normalized address).

### 6. Hardening

- PWA offline shell + install; backups (Postgres dump + MinIO); health checks.
- Load/abuse testing; monitoring dashboards.

## Key semantics

### Visibility (asymmetric ranges)

- A post carries `scope` = author's max reach (`building`, `500m`, `1km`, `5km`).
- A viewer carries `search_radius`.
- Visibility = `distance <= scope` AND `distance <= search_radius`;
  `building` requires a matching normalized address key.

### Cold bootstrap

- Feed auto-expands radius until ~10 posts (ceiling ~50km).

### Trust ladder

- New devices can post immediately but with reduced reach until they accrue
  trust (age, no reports, engagement).
- Phone verification is a later, optional *reach* gate — never a read gate.
