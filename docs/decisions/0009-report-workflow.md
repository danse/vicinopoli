# 0009 — Report workflow

- Status: accepted
- Date: 2026-08-12

## Context

Low-threshold, anonymous posting needs a lightweight but defined moderation
loop.

## Decision

- Reports follow a state machine:

```
submitted -> (auto-hide at N distinct-device reports) -> pending
pending   -> (moderator) -> dismissed (restored) | hidden | banned_device
```

- Auto-hide at a threshold (e.g. 3 distinct devices) gives immediate relief;
  human review happens in a minimal admin surface (later milestone).
- No user-facing notifications in the MVP.

## Consequences

- A `reports` table with `status` and device ids for pattern detection.
- The feed filter excludes posts whose status is `hidden` or auto-hidden.
