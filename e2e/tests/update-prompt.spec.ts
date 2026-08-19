import { expect, test } from "@playwright/test";

test("the app asks to update when a new version is deployed", async ({
  page,
}) => {
  const realSw = await (await page.request.get("/sw.js")).text();

  // Serve a byte-different sw.js on the first install. When the browser later
  // checks for updates on reload, the real sw.js (different bytes) installs a
  // new worker, which goes to "waiting" and triggers the update prompt.
  // Playwright cannot route SW main-script update fetches (#14711), so this
  // relies on the installed script differing from what the server now serves.
  await page.context().route("**/sw.js", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `/* installed-version ${Date.now()} */\n${realSw}`,
      headers: { "Cache-Control": "no-cache" },
    }),
  );

  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  // A new deployment changes sw.js on the server; reload checks for updates.
  await page.reload();

  // The prompt appears with an update action.
  await expect(page.getByTestId("update-prompt")).toBeVisible();
  await expect(page.getByTestId("update-prompt-reload")).toBeVisible();

  // Clicking "update" must skip the waiting worker and reload into the new
  // version; the prompt then disappears (regression: injectManifest SW had no
  // SKIP_WAITING handler, so the button did nothing).
  await page.getByTestId("update-prompt-reload").click();
  await expect(page.getByTestId("update-prompt")).toBeHidden({ timeout: 10_000 });
});