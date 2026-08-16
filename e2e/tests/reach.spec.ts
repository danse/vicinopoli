import { expect, test } from "@playwright/test";

import { openComposer, publish, setAddress } from "./helpers";

test("composer defaults to the whole-city voice (longest reach)", async ({
  page,
}) => {
  await openComposer(page);
  await expect(page.getByTestId("composer-voice-city")).toBeChecked();
});

test("a default-voice post reaches a neighbour at a nearby address", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const userA = await contextA.newPage();
  const contextB = await browser.newContext();
  const userB = await contextB.newPage();

  const body = `reach ${Date.now()}`;

  await openComposer(userA);
  // Default voice is already "city": publish without changing it.
  await publish(userA, body);
  await expect(userA.getByText(body)).toBeVisible();

  // A neighbour ~270m away (a different normalized key) still sees it under
  // the default city voice.
  await setAddress(userB, "Piazza Venezia, Roma");
  await expect(userB.getByText(body)).toBeVisible();

  await contextB.close();
  await contextA.close();
});