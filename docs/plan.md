# Plan

Roadmap and todos for **vicinopoli**.

## Vision

A localized social network with an extremely low entry threshold: open the PWA,
enter an address, optionally choose a pseudonym, and immediately post text,
voice, or photos to your neighbours. No account, no password.

Initial target: Italy. Internationalisation (i18n) in place from day one
(`it` default, `en` parallel).

## Key semantics

### Reach model (voice / fixed neighbour-count / visibility)

Three distinct concepts, never conflated:

- **Voice** — the author's fuzzy intent when composing: `street`, `some`,
  `area`, `city`. User-facing string; it is what the composer offers
  (`street` / some neighbours / the neighbourhood / the whole city).
- **Neighbour-count `K`** — a **fixed, trust-free** constant `NEIGHBOUR_K = 25`
  (distinct *other* active posters). It no longer depends on the trust ladder
  (ADR 0022; this is what caused asymmetric visibility — an extra poster near
  the author collapsed reach to the 500m step, hiding a far new neighbour).
- **Reach (`reach_m`)** — the distance a post actually travels, converted from
  voice + `K` at feed-serve time and clamped to `[0, 50km]`. It is the
  **author's max reach**.

### Visibility (asymmetric ranges)

- A viewer carries `search_radius`.
- Visibility = `distance <= post.reach_m` AND `distance <= search_radius`;
  `street` voice yields `reach_m = 0` (requires matching normalized address key).
- Conversion (per feed request): `reach_m` = the smallest radius, walking
  `500m -> 1km -> 5km -> 20km -> 50km`, that contains `K` distinct *other*
  active posters relative to the post's location. If fewer than `K` others
  exist anywhere, `reach_m = 50km` (sparse-area honesty, so a lone new user can
  still reach a distant community).

### Cold bootstrap

- Feed auto-expands radius until ~10 posts (ceiling ~50km).
- Because `K` is fixed and reach auto-expands in sparse areas, two brand-new
  neighbours always reach each other (auto-expanding to 50km if sparse), which
  resolves the cold-start problem without a km-cap or a trust cap.

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

- search radius computed once per feed rather than per post to save performance. This also allows the "Entro <x> km" label on the feed to be accurate

- push notifications
- message page, activated on clicking. Image shows full-screen in there
- post removal
- post editing: should happen within a time window

#### Wednesday 19

- definition of a read message
- annoying location bar covering "entra in zona"

#### Thursday 20

- functional reactive programming (new posts and realtime mode)
- search engine optimisation

#### Friday 21

- rendering of links and previews from youtube, instagram, facebook, twitter, reddit, soundcloud etcetera
- re-enable the feed heatmap

#### 24-28

- account page
- denial of service surface with changing device id, like we do in pagination tests

### Moon

- campaign: ${ibla,ragusa}-${eventi,events,chat}

- equalise
- replies and threading user experience
- send a notification upon a reply
- range map in composer
- distance UX: colour-code post cards by distance band and/or a small proximity visualisation (rings/intensity), as a future enhancement
- address geocoded on the client and shown on map with the range (unsure whether on the address page or post page)
- self-hosted photon
- monetization scheme, report commercial/advertisement/business
- WARN: Detected default credentials 'minioadmin:minioadmin', we recommend that you change these values with 'MINIO_ROOT_USER' and 'MINIO_ROOT_PASSWORD' environment variables
- blind accessibility test for audio content workflows
- add arabic
- diffusione
- street numbers
- content-spike detection with address

- crowfunding campaign
