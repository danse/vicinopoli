# Plan

Roadmap and milestones for **vicinopoli**.

## Vision

A localized social network with an extremely low entry threshold: open the PWA,
enter an address, optionally choose a pseudonym, and immediately post text,
voice, or photos to your neighbours. No account, no password.

Initial target: Italy. Internationalisation (i18n) in place from day one
(`it` default, `en` parallel).

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

## To do

Ordered by priority, remove from the list when done

- about the cold start: users start with limited reach. Even if the feed gets up to 50 kilometers, each user's reach gets up to 5 kilometers so they will not be able to read each other
- how does prometheus work?
- verify backend connection to sentry
- replies and threading
- send a notification upon a reply
- pages and routing
- search engine optimisation
- blind accessibility test for audio content workflows
