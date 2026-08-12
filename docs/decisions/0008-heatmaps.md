# 0008 — Heatmaps and mobile maps

- Status: accepted
- Date: 2026-08-12

## Context

Heatmaps of activity are important, and mobile performance + privacy matter.

## Decision

- Precompute H3/geohash cell aggregates server-side; serve density as a tile
  layer (PostGIS + a tile endpoint, or Martin). Never ship raw points to the
  client for heatmaps.
- Render with MapLibre GL JS (open-source), with a canvas fallback for old
  devices.
- **Privacy:** heatmaps show density only — never individual homes. Posts show
  distance-from-viewer, never a precise pin.

## Consequences

- An `activity_cells` table (cell -> count) maintained on write.
- Client fetches tiles, not point lists, for the heatmap layer.
