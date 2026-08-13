import { expect, test } from "@playwright/test";

test("a user can post a text message and see it in the feed", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByLabel("Il tuo indirizzo").fill("Via Roma 1, Roma");
  await page.getByLabel("Scrivi un messaggio").fill("Ciao vicini!");
  await page.getByRole("button", { name: "Pubblica" }).click();

  await expect(page.getByText("Ciao vicini!")).toBeVisible();
});
