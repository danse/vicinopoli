import { expect, test } from "@playwright/test";

const uniqueBody = (prefix: string) => `${prefix} ${Date.now()}`;

test("a building-scoped post is only visible to the same address", async ({
  page,
}) => {
  const body = uniqueBody("Per il palazzo");

  await page.goto("/");
  await page.getByTestId("composer-address").fill("Via Roma 1, Roma");
  await page.getByTestId("composer-message").fill(body);
  await page.getByTestId("composer-voice-building").check();
  await page.getByRole("button", { name: "Pubblica" }).click();
  await expect(page.getByText(body)).toBeVisible();

  // The same address (same normalized key) still sees the post in a fresh
  // browsing context: a new device without cookies.
  const neighbour = await page.context().newPage();
  await neighbour.goto("/");
  await neighbour.getByTestId("composer-address").fill("Via Roma 1, Roma");
  await expect(neighbour.getByText(body)).toBeVisible();

  // A different address (different normalized key) must NOT see it.
  const elsewhere = await page.context().newPage();
  await elsewhere.goto("/");
  await elsewhere.getByTestId("composer-address").fill("Piazza Venezia, Roma");
  await expect(elsewhere.getByText(body)).not.toBeVisible();
});