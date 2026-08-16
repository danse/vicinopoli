import { describe, expect, it, vi } from "vitest";

import { toHeatmapPoints } from "@/components/heatmap";

vi.mock("maplibre-gl", () => ({
  default: {
    Map: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      getSource: vi.fn().mockReturnValue({ setData: vi.fn() }),
    })),
    GeoJSONSource: class {},
  },
}));

describe("toHeatmapPoints", () => {
  it("turns cell polygons into weighted points", () => {
    const features = [
      {
        type: "Feature",
        properties: { cell: "sr1", count: 3 },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [12.48, 41.89],
              [12.5, 41.89],
              [12.5, 41.9],
              [12.48, 41.9],
              [12.48, 41.89],
            ],
          ],
        },
      },
    ];
    const points = toHeatmapPoints(features);
    expect(points).toHaveLength(1);
    expect(points[0].geometry.type).toBe("Point");
    expect(points[0].properties.count).toBe(3);
  });

  it("returns an empty list for no cells", () => {
    expect(toHeatmapPoints([])).toEqual([]);
  });
});
