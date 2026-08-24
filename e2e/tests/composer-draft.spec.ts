import { expect, test } from "@playwright/test";

import { openComposer, setPseudonym } from "./helpers";

test("the composer message survives a pseudonym change", async ({ page }) => {
  await openComposer(page);
  await page.getByTestId("composer-message").fill("Messaggio da non perdere");
  await setPseudonym(page, "Gina");
  await expect(page.getByTestId("composer-message")).toHaveValue(
    "Messaggio da non perdere",
  );
});

test("a selected photo survives a pseudonym change", async ({ page }) => {
  await openComposer(page);
  await page.getByTestId("composer-type-photo").click();
  await page.getByTestId("composer-photo").setInputFiles("./test-photo.png");
  await setPseudonym(page, "Gina");
  await expect(page.getByTestId("composer-photo")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pubblica" })).toBeEnabled();
});