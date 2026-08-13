import { expect, test } from "@playwright/test";

const uniqueBody = (prefix: string) => `${prefix} ${Date.now()}`;

test("a user can post a text message and see it in the feed", async ({
  page,
}) => {
  const body = uniqueBody("Ciao vicini");

  await page.goto("/");

  await page.getByLabel("Il tuo indirizzo").fill("Via Roma 1, Roma");
  await page.getByLabel("Scrivi un messaggio").fill(body);
  await page.getByRole("button", { name: "Pubblica" }).click();

  await expect(page.getByText(body)).toBeVisible();
});

test("a user can choose a pseudonym and it appears as the post author", async ({
  page,
}) => {
  const body = uniqueBody("Ciao a tutti");
  const pseudonym = `Gino${Date.now() % 10000}`;

  await page.goto("/");

  await page.getByLabel("Il tuo indirizzo").fill("Via Roma 1, Roma");
  await page.getByLabel("Scegli un nome").fill(pseudonym);
  await page.getByLabel("Scrivi un messaggio").fill(body);
  await page.getByRole("button", { name: "Pubblica" }).click();

  await expect(page.getByText(body)).toBeVisible();
  await expect(page.getByText(pseudonym)).toBeVisible();
});