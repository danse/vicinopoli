import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { geocode, getHeatmapTile } from "@/api/client";

interface HeatmapProps {
  address: string;
}

const ZOOM = 12;

interface CellFeature {
  type: string;
  properties: { cell: string; count: number };
  geometry: { type: string; coordinates: number[][][] };
}

/** Convert cell polygons into heatmap points weighted by density. */
export function toHeatmapPoints(features: CellFeature[]) {
  return features.map((feature) => {
    const ring = feature.geometry.coordinates[0];
    const lon = ring.reduce((sum, p) => sum + p[0], 0) / ring.length;
    const lat = ring.reduce((sum, p) => sum + p[1], 0) / ring.length;
    return {
      type: "Feature",
      properties: { count: feature.properties.count },
      geometry: { type: "Point", coordinates: [lon, lat] },
    };
  });
}

function tileFor(lon: number, lat: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor(
    ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n,
  );
  return { x, y };
}

export function Heatmap({ address }: HeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    geocode(address)
      .then((center) => {
        if (cancelled || !containerRef.current) return;
        const { x, y } = tileFor(
          center.cell_center_longitude,
          center.cell_center_latitude,
          ZOOM,
        );
        return getHeatmapTile(ZOOM, x, y).then((tile) => {
          if (cancelled) return;
          const map =
            mapRef.current ??
            new maplibregl.Map({
              container: containerRef.current!,
              style: {
                version: 8,
                sources: {},
                layers: [
                  {
                    id: "background",
                    type: "background",
                    paint: { "background-color": "#e8ecef" },
                  },
                ],
              },
              center: [center.cell_center_longitude, center.cell_center_latitude],
              zoom: ZOOM,
            });
          mapRef.current = map;
          map.on("load", () => {
            if (map.getSource("activity")) {
              (map.getSource("activity") as maplibregl.GeoJSONSource).setData({
                type: "FeatureCollection",
                features: toHeatmapPoints(tile.features as unknown as CellFeature[]),
              });
            } else {
              map.addSource("activity", {
                type: "geojson",
                data: {
                  type: "FeatureCollection",
                  features: toHeatmapPoints(tile.features as unknown as CellFeature[]),
                },
              });
              map.addLayer({
                id: "heat",
                type: "heatmap",
                source: "activity",
                paint: {
                  "heatmap-weight": ["get", "count"],
                  "heatmap-radius": 40,
                },
              });
            }
          });
        });
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  if (error) return null;

  return (
    <section aria-label="Mappa" data-testid="heatmap">
      <div className="h-64 w-full rounded-lg border" ref={containerRef} />
    </section>
  );
}