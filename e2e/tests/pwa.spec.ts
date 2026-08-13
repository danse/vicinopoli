import { expect, test } from "@playwright/test";

test("the PWA shell is installable and works offline", async ({ page }) => {
  await page.goto("/");

  // The manifest is served with the icons required for installation.
  const manifestResponse = await page.request.get(
    "http://localhost:8080/manifest.webmanifest",
  );
  expect(manifestResponse.ok()).toBe(true);
  const manifest = (await manifestResponse.json()) as { icons?: { src: string; sizes: string }[] };
  expect(manifest.icons?.length).toBeGreaterThanOrEqual(2);
  const sizes = new Set((manifest.icons ?? []).map((i) => i.sizes));
  expect(sizes).toContain("192x192");
  expect(sizes).toContain("512x512");

  // Every declared icon resolves through the reverse proxy.
  for (const icon of manifest.icons ?? []) {
    const response = await page.request.get(
      `http://localhost:8080${icon.src}`,
    );
    expect(response.ok()).toBe(true);
  }

  // The service worker registers and takes control of the page.
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  });
  const controlled = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!registration.active) return false;
    if (navigator.serviceWorker.controller) return true;
    return new Promise<boolean>((resolve) => {
      navigator.serviceWorker.addEventListener("controllerchange", () =>
        resolve(true),
      );
      setTimeout(() => resolve(false), 3000);
    });
  });
  expect(controlled).toBe(true);

  // Offline, the app shell still loads from the service worker cache.
  await page.reload();
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "vicinopoli" })).toBeVisible();
});