# 0005 — Identity and trust ladder

- Status: accepted
- Date: 2026-08-12
- Amended: 2026-08-14 (reach gate is now a neighbour-count, not a km cap)

## Context

The entry threshold must be near zero (no login), but abuse becomes likely at
scale.

## Decision

- **Identity:** anonymous device token (httpOnly cookie) created on first visit,
  plus an optional pseudonym. No password, no email.
- **Trust ladder:** new/unknown devices can post immediately but with reduced
  reach until they accrue trust (age, no reports, engagement). The reach gate
  is a *neighbour-count* cap `K` (how many distinct other active posters a post
  may reach): `UNTRUSTED_K = 1`, `TRUSTED_K = 25` (plan: Reach model). This
  replaces the old km-based cap on scope; the `street` voice is always
  honoured.
- Phone/email verification is a later, optional *reach* gate — never a read gate.

## Consequences

- A `devices` table with a `trust_score`/`verified` field.
- Feed queries must account for device trust when deciding reach (via `K`,
  converted to a distance at serve time).
