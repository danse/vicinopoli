import { expect, test } from "@playwright/test";

import { openComposer } from "./helpers";

test("an unknown address shows address-not-found instead of generic publish error", async ({
  page,
}) => {
  await openComposer(page, "Via Inesistente 99, Città");

  await page.getByTestId("composer-message").fill("ciao");
  await page.getByRole("button", { name: "Pubblica" }).click();

  await expect(page.getByText("Indirizzo non trovato")).toBeVisible();
  await expect(
    page.getByText("Non è stato possibile pubblicare. Riprova."),
  ).not.toBeVisible();
});