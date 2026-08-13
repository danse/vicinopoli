# Plan

Roadmap and milestones for **vicinopoli**.

## Vision

A localized social network with an extremely low entry threshold: open the PWA,
enter an address, optionally choose a pseudonym, and immediately post text,
voice, or photos to your neighbours. No account, no password.

Initial target: Italy. Internationalisation (i18n) in place from day one
(`it` default, `en` parallel).

## Milestones

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

## Other tasks


- github integration failed with: "Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/checkout@v4, actions/setup-python@v5, astral-sh/setup-uv@v4. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/"
- set vicinopoli.it in configs now that it's registered, page returns "secure connection failed" at the moment
- range-adjusting controls
- connect the backend to sentry
- blind accessibility test for audio content workflows
