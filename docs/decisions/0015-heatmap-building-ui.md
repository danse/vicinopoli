# 0015 — Heatmap tile endpoint and street scope in UI

- Status: accepted
- Date: 2026-08-13

## Context

Milestone 5 requires a density heatmap and street-level visibility. ADR 0008
left the tile-serving mechanism open ("PostGIS + a tile endpoint, or Martin"),
and the `street` scope (ADR 0006) was already implemented in the feed service
but had no UI to choose it.

## Decision

- **Tile endpoint, not Martin.** The backend serves `GET /api/heatmap/{z}/{x}/{y}`
  directly from the `activity_cells` table (cell → count, maintained on write).
  Martin is not introduced: it would add a new service + config for data that
  already lives in Postgres and is small. The tile payload is GeoJSON cell
  polygons with `properties.count` — density only, never individual points or
  post content.
- **Density is aggregated per geohash cell at precision 6**, keyed off the
  existing `locations.geohash`. Counts bump on post creation and shrink when a
  post is auto-hidden by reports (ADR 0009), so the heatmap always mirrors what
  a viewer can actually see.
- **Coarse geocoding for the client.** The map must centre on the user's
  neighbourhood, but exact coordinates must never leave the server (ADR 0008).
  `GET /api/geocode` returns the *cell centre* and the cell id — never the
  precise geocode — so the client can centre MapLibre GL without learning a
  precise location.
- **MapLibre GL JS** renders the heatmap on the client from the tile features
  (cell polygon centroids weighted by `count`). No pins, no bodies.
- **Street scope in the UI.** The composer gains a scope selector
  (`street` / `500m` / `1km` / `5km`). The backend already honoured
  `street` per ADR 0006; this merely exposes it.

## Consequences

- Heatmap reads are cheap and consistent with the report workflow.
- The frontend depends on `maplibre-gl`; unit tests mock it, e2e verifies the
  tile endpoint through Caddy.
- Cell size is fixed at precision 6; if the neighbourhoods get much denser we
  can add per-zoom aggregation without changing the endpoint contract.
