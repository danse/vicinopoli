# 0025 — Push notifications: opt-in, reach-honest, inbox-testable

- Status: accepted
- Date: 2026-08-18
- Related: [glossary.md](../glossary.md), [0024-scope-from-voice.md](0024-scope-from-voice.md)

## Context

Plan.md's next todo is push notifications. vicinopoli has no accounts — the
only identity is an anonymous device cookie (ADR 0005) — and never stores raw
addresses or exact coordinates, only geohash cells (ADR 0004, privacy
convention). Notifications must fit both constraints.

The product question: *when* does a notification fire? Not for every post —
that is noise. The honest answer reuses the reach model (ADR 0024): a
notification fires when a new post's **reach covers the subscriber's area and
the post would appear in the subscriber's feed** (same visibility predicate:
`distance <= reach(voice)`, post active, not the author's own post).

Two hard constraints shape the design:

- **Privacy:** the server stores the subscriber's area as a geohash cell, never
  an address or exact point.
- **Testability:** real Web Push (FCM/Mozilla autopush/APNs) is unreachable
  from pytest and impractical in Playwright. The send path must be injectable.

## Decision

### Opt-in: a toggle in the feed

A switch in the feed ("avvisami quando qualcuno posta vicino a me") enables and
disables push for the device. Enabling requests browser `Notification`
permission, subscribes via the service worker with the VAPID public key, and
POSTs the subscription to the backend. Disabling unsubscribes and deletes the
server-side row. Re-enabling (or a changed address) updates the stored cell.

### The subscription: device + cell, no raw coords

`push_subscriptions` holds, per device: the Web Push `endpoint`, the
`p256dh`/`auth` keys, and the subscriber's **area as a geohash cell at
precision 7** (≈150m cells). The cell's centre is stored as a GiST `geography`
point, mirroring `locations` and `activity_cells`. The address is sent on the
wire for geocoding (as `POST /api/posts` already does) but only the cell centre
is persisted.

### Notify: one query, background

On post creation, after commit, a FastAPI `BackgroundTask` finds candidate
subscriptions with a single `ST_DWithin` query: `distance(post_point,
sub_cell_centre) <= reach(voice) + CELL_SLACK_M`, excluding the author's own
device. `CELL_SLACK_M` (~110m, half the cell diagonal) covers the geohash
approximation so a subscriber at a cell edge never misses a post that would
reach their real address. The payload is the post body, voice, display address
and timestamp — never coordinates or the author's device id.

### Sender: mock by default, VAPID in prod

- `PUSH_SENDER=mock` (dev/test default): the sender HTTP-POSTs the payload to
  the subscription's `endpoint` verbatim. E2E points the endpoint at the
  admin-gated inbox route (`GET /api/admin/push/inbox`), so the full pipeline
  (new post -> visibility check -> delivery) is asserted against the running
  stack without a real push service.
- `PUSH_SENDER=webpush` (production): `pywebpush` signs the payload with the
  VAPID private key (RFC 8292) and delivers to the push service.
- VAPID keys are read from env (`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`); when
  unset (dev/test) an ephemeral pair is generated at startup and the public key
  is served by `GET /api/push/config`.

## Consequences

- Notifications are honest: a subscriber is notified exactly when a post would
  appear in their feed, within geohash-cell slack.
- No new PII: cell centres only, consistent with the existing heatmap and
  location patterns.
- The full notify pipeline is testable end-to-end against the running stack via
  the mock sender + inbox; unit tests use a recording sender.
- Opt-in is explicit and reversible; the composer is untouched.
- The service worker switches to `injectManifest` (custom `push` and
  `notificationclick` listeners) since `generateSW` cannot handle push.