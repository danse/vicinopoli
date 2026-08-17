# 0021 — Internal admin firehose

- Status: accepted
- Date: 2026-08-17

## Context

The plan asks for "a simple content-control interface: how to add an interface
for an administrator to check all the submitted contents (firehose)?". The
public feed only ever surfaces posts that passed the visibility rules (scope
radius, report auto-hiding), so content that was auto-hidden or manually hidden
is invisible to everyone — including the people who should be able to review
whether that hiding was correct. Today there is no way to review all submitted
content at all.

A firehose is inherently a trusted, internal tool. It must not be reachable
from the public internet, must not allow anonymous access, and should not
expand the public attack surface. We also want it to *not* grow into a
moderation console in this iteration: the goal is visibility first.

## Decision

- **A read-only admin firehose, bound to the loopback interface only.**
  - A new `admin` compose service reuses the frontend build image (same bundle,
    same build args) but serves a dedicated `admin.html` entry through its own
    nginx config (`frontend/admin-nginx.conf`).
  - It binds `127.0.0.1:8081` in both dev and prod compose (like Prometheus and
    Grafana), so it is reachable only via an SSH tunnel from the operator's
    machine. The public nginx (`frontend/nginx.conf`) returns 404 for
    `/admin.html` so the entry can never leak through Caddy.
  - The admin app proxies `/api/*` to the backend through nginx; it shares the
    generated API types and the `@/` alias, but is a separate Vite entry
    (`build.rollupOptions.input`) that the service worker never precaches or
    serves (`globIgnores: ["admin.html", "assets/admin-*"]`).
- **Shared admin token auth (`ADMIN_TOKEN`).**
  - Every admin route depends on `require_admin`, which compares the
    `X-Admin-Token` header against the configured `ADMIN_TOKEN` in constant
    time (`hmac.compare_digest`). It fails closed: if `ADMIN_TOKEN` is unset or
    empty, admin endpoints return 401 even with a token supplied.
  - The admin page prompts for the token, keeps it in `localStorage`
    (`vicinopoli.admin-token`), and auto-signs-in on later visits from the
    stored value. A typed token only takes effect on button click, so typing
    can never swap the form out from under the user.
- **The firehose lists every post, newest first.**
  - `GET /api/admin/posts` returns posts of **all** statuses (active,
    auto_hidden, hidden) with keyset pagination reusing the feed's
    `encode_cursor`/`decode_cursor`.
  - Each item carries `id`, `body`, `voice`, `status`, `display_address`,
    `geohash`, `created_at`, `pseudonym`, `new_neighbour`, `report_count`,
    `device_id` and `media` (signed URLs via `media_info`).
  - **No raw coordinates**: only geohash and the reverse-geocoded display
    address are exposed, consistent with the rest of the API.
- **A "jump into the zone" link.**
  - Each admin card links to the public app's address page with
    `?address=<encoded>`. The address page *overwrites* the stored address from
    this query parameter (applied once on mount) — unlike geolocation prefill,
    which only fills when no address is stored yet — so the operator lands
    directly in the reported zone and can read the public context around it.
  - The public base URL is injected at build time via `VITE_PUBLIC_BASE_URL`
    (dev: `http://localhost:8080`, prod: `https://${DOMAIN}`), because the
    admin app lives on a different origin than the public app.
- **Frontend** gets a `PostMedia` component extracted from `Feed`, reused by
  the admin card; the public `Feed` card markup is otherwise untouched.

### Rejected alternatives

- **Reuse the public `PostCard`** — admin and public cards diverge too far
  (status + report count + device id + geohash vs distance + new-neighbour);
  only the media block is shared.
- **Moderation actions in this iteration** (hide/restore/ban) — the firehose is
  explicitly read-only; actions can build on `require_admin` later.
- **Per-user admin accounts** — no login system exists; a shared token with an
  SSH-tunnelled loopback binding is the minimal viable gate and matches the
  existing Prometheus/Grafana pattern.
- **Public route to the admin** — would require auth cookies/CSRF machinery on
  the public Caddy and expand the attack surface for no benefit.

## Consequences

- Operators reach the firehose over an SSH tunnel (`tunnel.dot` forwards
  `127.0.0.1:8081`) and authenticate with `X-Admin-Token`.
- `ADMIN_TOKEN` is a required prod secret (`deploy/.env.prod.example`), default
  `dev-admin-token` in dev compose so e2e can run against the loopback stack.
- Admin tests cover: token required/wrong/fail-closed, report counts, all
  statuses listed, no coordinate keys, media serialization, keyset pagination
  and invalid cursors.
- `docs/pages.md` documents the admin page and its testids, plus the
  `?address=` overwrite behaviour on the address page.