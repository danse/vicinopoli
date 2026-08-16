import { expect, test } from "@playwright/test";

import { openComposer, publish, setAddress } from "./helpers";

const uniqueBody = (prefix: string) => `${prefix} ${Date.now()}`;

test("a building-scoped post is only visible to the same address", async ({
  page,
}) => {
  const body = uniqueBody("Per il palazzo");

  await openComposer(page);
  await page.getByTestId("composer-voice-building").check();
  await publish(page, body);
  await expect(page.getByText(body)).toBeVisible();

  // The same address (same normalized key) still sees the post in a fresh
  // browsing context: a new device without cookies.
  const neighbour = await page.context().newPage();
  await setAddress(neighbour, "Via Roma 1, Roma");
  await expect(neighbour.getByText(body)).toBeVisible();

  // A different address (different normalized key) must NOT see it.
  const elsewhere = await page.context().newPage();
  await setAddress(elsewhere, "Piazza Venezia, Roma");
  await expect(elsewhere.getByText(body)).not.toBeVisible();
});