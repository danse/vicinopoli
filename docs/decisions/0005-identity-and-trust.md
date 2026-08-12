# 0005 — Identity and trust ladder

- Status: accepted
- Date: 2026-08-12

## Context

The entry threshold must be near zero (no login), but abuse becomes likely at
scale.

## Decision

- **Identity:** anonymous device token (httpOnly cookie) created on first visit,
  plus an optional pseudonym. No password, no email.
- **Trust ladder:** new/unknown devices can post immediately but with reduced
  reach (smallest radius, flagged "new neighbour") until they accrue trust
  (age, no reports, engagement).
- Phone/email verification is a later, optional *reach* gate — never a read gate.

## Consequences

- A `devices` table with a `trust_score`/`verified` field.
- Feed queries must account for device trust when deciding reach.
