import { expect, test } from "@playwright/test";

import { openComposer, publish, setAddress } from "./helpers";

const uniqueBody = (prefix: string) => `${prefix} ${Date.now()}`;

test("a street-voice post reaches only the same address (5m reach)", async ({
  page,
}) => {
  const body = uniqueBody("Per la mia via");

  await openComposer(page);
  await page.getByTestId("composer-voice-street").check();
  await publish(page, body);
  await expect(page.getByText(body)).toBeVisible();

  // The same address (0m away, inside the 5m street reach) still sees the post
  // in a fresh browsing context: a new device without cookies.
  const neighbour = await page.context().newPage();
  await setAddress(neighbour, "Via Roma 1, Roma");
  await expect(neighbour.getByText(body)).toBeVisible();

  // A different address (~270m away, outside the 5m reach) must NOT see it.
  const elsewhere = await page.context().newPage();
  await setAddress(elsewhere, "Piazza Venezia, Roma");
  await expect(elsewhere.getByText(body)).not.toBeVisible();
});
