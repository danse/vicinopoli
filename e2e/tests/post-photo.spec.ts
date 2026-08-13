import { expect, test } from "@playwright/test";

const uniqueBody = (prefix: string) => `${prefix} ${Date.now()}`;

test("a user can attach a photo and see it in the feed", async ({ page }) => {
  const body = uniqueBody("Foto del quartiere");

  await page.goto("/");

  await page.getByLabel("Il tuo indirizzo").fill("Via Roma 1, Roma");
  await page.getByLabel("Scrivi un messaggio").fill(body);
  await page
    .getByLabel("Aggiungi una foto")
    .setInputFiles("./test-photo.png");
  await page.getByRole("button", { name: "Pubblica" }).click();

  await expect(page.getByText(body)).toBeVisible();
  const item = page
    .getByRole("listitem")
    .filter({ hasText: body });
  await expect(
    item.getByRole("img", { name: "Foto allegata" }),
  ).toBeVisible();
});