# 0004 — Geolocation model

- Status: accepted
- Date: 2026-08-12

## Context

Posts must be matched to neighbours by location, starting from a user-entered
address, with a later option to share only within the same building.

## Decision

- Address -> coordinates via geocoding, producing a normalized
  address key plus `point` (geography), latitude/longitude, and a geohash/H3
  cell. The provider is behind a `Geocoder` interface (ADR 0003-style): the
  current production provider is **Photon** (the public `photon.komoot.io` API
  initially, self-hosted later); Nominatim was replaced because the public
  nominatim.openstreetmap.org endpoint rate-limits production apps and its
  usage policy forbids them.
- Radius scopes (`building`, `500m`, `1km`, `5km`) are queried with
  `ST_DWithin` on a GiST-indexed geography column.
- **Same-building** scope matches on the *normalized address key*, stored from
  day one so it is a filter flag, not a schema change.

## Consequences

- A single canonical `locations` row per normalized address.
- Posts reference a location, not raw coordinates.
