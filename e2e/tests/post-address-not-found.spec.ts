import { expect, test } from "@playwright/test";

test("an unknown address shows address-not-found instead of generic publish error", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByLabel("Il tuo indirizzo").fill("Via Inesistente 99, Città");
  await page.getByLabel("Scrivi un messaggio").fill("ciao");
  await page.getByRole("button", { name: "Pubblica" }).click();

  await expect(page.getByText("Indirizzo non trovato")).toBeVisible();
  await expect(
    page.getByText("Non è stato possibile pubblicare. Riprova."),
  ).not.toBeVisible();
});