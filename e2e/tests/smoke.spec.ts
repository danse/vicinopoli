import { expect, test } from "@playwright/test";

test("API health returns ok through the reverse proxy", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body.status).toBe("ok");
  expect(body.app).toBe("vicinopoli");
});

test("the PWA shell is served and renders the app title", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "vicinopoli" })).toBeVisible();
});

test("the PWA shell shows a build version in the footer", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("app-footer")).toBeVisible();
  await expect(page.getByTestId("app-footer-version")).toHaveText(
    /^(dev|[0-9a-f]{7,})$/,
  );
});

test("index.html is revalidated so fresh asset identifiers are picked up", async ({
  request,
}) => {
  const response = await request.get("/");
  expect(response.headers()["cache-control"] ?? "").toMatch(
    /no-cache|max-age=0/,
  );
});

test("content-hashed assets are served as immutable", async ({ request }) => {
  const html = await (await request.get("/")).text();
  const assetPath = html.match(/assets\/index-[^"]+\.js/)?.[0];
  expect(assetPath).toBeDefined();

  const response = await request.get(`/${assetPath}`);
  expect(response.headers()["cache-control"] ?? "").toMatch(/immutable/);
});

test("the service worker is revalidated on every load", async ({ request }) => {
  const response = await request.get("/sw.js");
  expect(response.headers()["cache-control"] ?? "").toMatch(
    /no-cache|max-age=0/,
  );
});
