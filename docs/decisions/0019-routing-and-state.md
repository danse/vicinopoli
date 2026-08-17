# 0019 — Multi-page routing and shared state

- Status: accepted
- Date: 2026-08-16

## Context

The app is currently a single page: `App.tsx` stacks the composer, heatmap and
feed vertically, holding all shared state (`address`, `pseudonym`, consent,
feed refresh tick) in `useState` and passing it down as props. The product now
wants distinct pages (`address` -> `feed` -> `composer`, see `docs/pages.md`),
and later the app will become *responsive* (sockets, reactions), which may need
a more capable state architecture.

## Decision

- **Routing: React Router v7 (`react-router-dom`) with `BrowserRouter`.**
  The de-facto standard, small, typed. Deep links already work: nginx
  (`frontend/nginx.conf`) falls back to `/index.html` and the PWA service
  worker uses `navigateFallback`, so no server changes are required.
- **Routes:** `/` redirects to `/address`; `address`, `feed`, `composer`,
  `pseudonym` (set/clear the pseudonym, reached from the composer).
  `feed` and `composer` redirect back to `address` when no address is set.
  Routes are maintained in `docs/pages.md`.
- **Shared state: a small React Context** (`AppProvider` + `useApp()`)
  holding `address`, `pseudonym`, consent state and the feed refresh tick.
  No Redux, Zustand or other state library at this point.

### Deferred: FRP / streams (Bacon.js)

The plan explicitly records an earlier open question about adopting a more
abstract framework. Decision: **not now.** Rationale:

- The shared state surface is tiny; Context covers it without new dependencies.
- The app will go *responsive* later (WebSocket/SSE, reactions). A stream-based
  architecture (e.g. Bacon.js) is a strong candidate for that future state
  graph. Revisit when realtime transport is actually planned; record the
  outcome in a new ADR rather than forcing a paradigm in today.

## Consequences

- Page components live under `frontend/src/pages/`; cross-page state flows
  through the context, not props.
- `data-testid` anchors are documented per page in `docs/pages.md`; UI tests
  never query by copy.
- The composer no longer owns the address field; address is set on the
  `address` page and shown (read-only, with a "change" link) on `composer`.
- Adding a page later is one route + one file + one row in `docs/pages.md`.