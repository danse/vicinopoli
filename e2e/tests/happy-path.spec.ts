import { expect, test } from "@playwright/test";

import { openComposer, publish, setAddress } from "./helpers";

test("one user posts hello world and a second user reads it", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const userA = await contextA.newPage();
  const contextB = await browser.newContext();
  const userB = await contextB.newPage();

  const body = `hello world ${Date.now()}`;

  await openComposer(userA);
  await publish(userA, body);
  await expect(userA.getByText(body)).toBeVisible();

  await setAddress(userB, "Via Roma 1, Roma");
  await expect(userB.getByText(body)).toBeVisible();

  await contextB.close();
  await contextA.close();
});