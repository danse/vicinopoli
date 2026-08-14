# Plan

Roadmap and milestones for **vicinopoli**.

## Vision

A localized social network with an extremely low entry threshold: open the PWA,
enter an address, optionally choose a pseudonym, and immediately post text,
voice, or photos to your neighbours. No account, no password.

Initial target: Italy. Internationalisation (i18n) in place from day one
(`it` default, `en` parallel).

## Key semantics

### Reach model (voice / trust cap / visibility)

Three distinct concepts, never conflated:

- **Voice** — the author's fuzzy intent when composing: `building`, `some`,
  `area`, `city`. User-facing string; it is what the composer offers
  (`building` / some neighbours / the neighbourhood / the whole city).
- **Trust cap** — the neighbour-count `K` an author may reach, set by the trust
  ladder: `UNTRUSTED_K = 1`, `TRUSTED_K = 25` (distinct *other* active posters).
  This replaces the old km-based cap on scope.
- **Reach (`reach_m`)** — the distance a post actually travels, converted from
  voice + trust cap at feed-serve time and clamped to `[0, 50km]`. It is the
  **author's max reach**.

### Visibility (asymmetric ranges)

- A viewer carries `search_radius`.
- Visibility = `distance <= post.reach_m` AND `distance <= search_radius`;
  `building` voice yields `reach_m = 0` (requires matching normalized address key).
- Conversion (per feed request): `reach_m` = the smallest radius, walking
  `500m -> 1km -> 5km -> 20km -> 50km`, that contains `K` distinct *other*
  active posters relative to the post's location. If fewer than `K` others
  exist anywhere, `reach_m = 50km` (sparse-area honesty, so a lone new user can
  still reach a distant community).

### Cold bootstrap

- Feed auto-expands radius until ~10 posts (ceiling ~50km).
- Because voice `some` for an untrusted author yields `K = 1`, two brand-new
  neighbours always reach each other (auto-expanding to 50km if sparse), which
  resolves the cold-start problem without a km-cap.

### Trust ladder

- New devices can post immediately but with reduced reach until they accrue
  trust (age, no reports, engagement). Reach is reduced as a *neighbour-count*
  cap (`K`), not a km cap.
- Phone verification is a later, optional *reach* gate — never a read gate.

## To do

Ordered by priority, remove from the list when done

- refreshing the page risks to keep stale cached assets. Do we produce fresh static assets identifiers at each build?
- we want to have different pages in the app. Should we adopt some more abstract framework (for routing or state management), or you suggest keeping the frontend stack as is?
- test a new user flow: landing page only asks for where the user is. With the address submitted, user is prompted to a feed page. In the feed page there is a `+ (post message/express yourself/say something)` button that leads to the composer page
- replies and threading user experience
- send a notification upon a reply
- location from the browser
- user experience for updating the address: does it expose abuse scenarios?
- frontend app auto-updated on new versions
- campaign "la tua voce a ragusa"

- address geocoded on the client and shown on map with the range (unsure whether on the address page or post page)
- search engine optimisation
- self-hosted photon
- monetization scheme, report commercial/advertisement/business
- WARN: Detected default credentials 'minioadmin:minioadmin', we recommend that you change these values with 'MINIO_ROOT_USER' and 'MINIO_ROOT_PASSWORD' environment variables
- blind accessibility test for audio content workflows
