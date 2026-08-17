# 0020 — Feed pagination with keyset cursors

- Status: accepted
- Date: 2026-08-17

## Context

`GET /api/feed` built the whole feed in one shot: the expanding-radius loop
stops at the first ladder radius that reaches `target_count` visible posts and
returns **all** visible posts at that radius. With a busy neighbourhood (or
accumulated test data) that can be hundreds of DOM nodes, slowing rendering and
flaking UI tests. The plan calls for "feed pagination with endless scrolling".

Offset pagination (`?offset=N`) is not viable for a keyset-ordered feed: posts
are ordered by `created_at DESC`, new posts keep arriving, so offsets would
skip and duplicate rows.

## Decision

- **Keyset (cursor) pagination on the feed endpoint.**
  - `GET /api/feed` accepts `cursor`, an **opaque** token encoding the last
    post's `(created_at, id)`. The client never interprets it; the backend may
    change the scheme freely. We rejected exposing raw `before_created_at` /
    `before_id` query params: they leak ordering internals and the client
    plumbing is not meaningfully simpler.
  - The service orders posts `created_at DESC, id DESC` and filters
    `(created_at, id) < cursor` for subsequent pages.
  - The response carries `next_cursor` (`null` when there is no further page:
    the ladder reached the 50km ceiling with fewer than `target_count` posts,
    or the page was not full at a smaller radius).
  - Each page is capped at `target_count` posts (`visible[:target_count]`),
    which fixes the pre-existing "return everything in the first radius" bloat.
- **Frontend: endless scroll via IntersectionObserver.**
  - The `Feed` component keeps an accumulated `posts` list, a `next_cursor`,
    and a `data-testid="feed-load-more"` sentinel at the bottom of the list.
  - When the sentinel intersects the viewport (400px root margin) and a
    `next_cursor` exists, the next page is fetched and appended.
  - On address change or feed refresh the list resets to the first page.
  - Analytics report each newly-arrived batch once (deduped by post ids).

### Rejected alternatives

- **Offset pagination** — skips/duplicates under concurrent inserts.
- **Page-number pagination** — same problem, plus it changes the semantics of
  the expanding radius (which page's radius do later pages use?).
- **Non-opaque cursor params** — works, but leaks ordering internals into the
  API contract for no client-side gain.

## Consequences

- `/api/feed` responses are bounded by `target_count`; large feeds render in
  pages instead of one huge list.
- Backend tests create posts from fresh devices (cookie cleared) so the
  per-device post rate limit stays enabled and posts are never silently
  dropped; the `_create_post` helper asserts a 201 with a loud failure message.
- The frontend keeps deduplicating analytics reporting across pages.
- `docs/pages.md` documents the new `feed-load-more` testid.
