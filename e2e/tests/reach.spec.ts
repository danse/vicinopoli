import { expect, test } from "@playwright/test";

test("composer defaults to the whole-city voice (longest reach)", async ({
  page,
}) => {
  await page.goto("/");
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

  await userA.goto("/");
  await userA.getByTestId("composer-address").fill("Via Roma 1, Roma");
  await userA.getByTestId("composer-message").fill(body);
  // Default voice is already "city": publish without changing it.
  await userA.getByRole("button", { name: "Pubblica" }).click();
  await expect(userA.getByText(body)).toBeVisible();

  // A neighbour ~270m away (a different normalized key) still sees it under
  // the default city voice.
  await userB.goto("/");
  await userB.getByTestId("composer-address").fill("Piazza Venezia, Roma");
  await expect(userB.getByText(body)).toBeVisible();

  await contextB.close();
  await contextA.close();
});