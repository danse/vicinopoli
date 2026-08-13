import { expect, test } from "@playwright/test";

test("one user posts hello world and a second user reads it", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const userA = await contextA.newPage();
  const contextB = await browser.newContext();
  const userB = await contextB.newPage();

  const body = `hello world ${Date.now()}`;

  await userA.goto("/");
  await userA.getByLabel("Il tuo indirizzo").fill("Via Roma 1, Roma");
  await userA.getByLabel("Scrivi un messaggio").fill(body);
  await userA.getByRole("button", { name: "Pubblica" }).click();
  await expect(userA.getByText(body)).toBeVisible();

  await userB.goto("/");
  await userB.getByLabel("Il tuo indirizzo").fill("Via Roma 1, Roma");
  await expect(userB.getByText(body)).toBeVisible();

  await contextB.close();
  await contextA.close();
});