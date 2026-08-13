import { expect, test } from "@playwright/test";

const VIA_ROMA = { lat: 41.8933, lon: 12.4829 };

function slippyTile(lat: number, lon: number, z: number) {
  const x = Math.floor(((lon + 180) / 360) * 2 ** z);
  const y = Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) /
      2) *
      2 ** z,
  );
  return { x, y };
}

test("heatmap tiles expose aggregated density, never post bodies", async ({
  page,
}) => {
  const body = `Densità in zona ${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("Il tuo indirizzo").fill("Via Roma 1, Roma");
  await page.getByLabel("Scrivi un messaggio").fill(body);
  await page.getByRole("button", { name: "Pubblica" }).click();
  await expect(page.getByText(body)).toBeVisible();

  // The heatmap tile endpoint must return density cells (counts per geohash
  // cell) for a tile covering the post, never individual post bodies/pins.
  const zoom = 12;
  const tile = slippyTile(VIA_ROMA.lat, VIA_ROMA.lon, zoom);
  const response = await page.request.get(
    `http://localhost:8080/api/heatmap/${zoom}/${tile.x}/${tile.y}`,
  );
  expect(response.ok()).toBe(true);
  const data = (await response.json()) as {
    type: string;
    features: {
      properties: { cell: string; count: number };
    }[];
  };
  expect(data.type).toBe("FeatureCollection");
  expect(data.features.length).toBeGreaterThan(0);
  const total = data.features.reduce((sum, f) => sum + f.properties.count, 0);
  expect(total).toBeGreaterThan(0);
  const serialized = JSON.stringify(data);
  expect(serialized).not.toContain(body);
});