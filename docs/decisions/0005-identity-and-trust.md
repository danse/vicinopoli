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
- **Trust ladder:** new/unknown devices can post immediately but with a reduced
  *daily posting quota* (3 posts/day) until they accrue trust by age (7 days,
  no reports → 30 posts/day, ADR 0022). Trust no longer gates reach — reach is
  a fixed, trust-free property of the post's voice (`VOICE_TO_REACH_M`, ADR
  0024). The earlier neighbour-count cap `K` (`UNTRUSTED_K = 1`,
  `TRUSTED_K = 25`) is superseded; the `street` voice is always honoured.
- Phone/email verification is a later, optional *reach* gate — never a read gate.

## Consequences

- A `devices` table with a `trust_score`/`verified` field.
- Trust gates the daily posting quota (ADR 0022), never the feed: reach is a
  fixed voice→distance lookup computed per post, so the feed needs no
  per-device trust conversion.
