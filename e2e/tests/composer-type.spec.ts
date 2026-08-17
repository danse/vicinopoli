import { expect, test } from "@playwright/test";

import { openComposer } from "./helpers";

test("the composer defaults to the text type", async ({ page }) => {
  await openComposer(page);

  await expect(page.getByTestId("composer-message")).toBeVisible();
  await expect(page.getByTestId("composer-photo")).not.toBeVisible();
  await expect(page.getByTestId("composer-voice-start")).not.toBeVisible();
});

test("selecting the photo type shows the photo picker and hides the voice recorder", async ({
  page,
}) => {
  await openComposer(page);

  await page.getByTestId("composer-type-photo").click();

  await expect(page.getByTestId("composer-photo")).toBeVisible();
  await expect(page.getByTestId("composer-voice-start")).not.toBeVisible();
  await expect(page.getByTestId("composer-message")).toBeVisible();
});

test("selecting the voice type shows the recorder and hides the photo picker", async ({
  page,
}) => {
  await openComposer(page);

  await page.getByTestId("composer-type-voice").click();

  await expect(page.getByTestId("composer-voice-start")).toBeVisible();
  await expect(page.getByTestId("composer-photo")).not.toBeVisible();
  await expect(page.getByTestId("composer-message")).toBeVisible();
});

test("switching back to the text type hides both media inputs", async ({
  page,
}) => {
  await openComposer(page);

  await page.getByTestId("composer-type-photo").click();
  await page.getByTestId("composer-type-text").click();

  await expect(page.getByTestId("composer-message")).toBeVisible();
  await expect(page.getByTestId("composer-photo")).not.toBeVisible();
  await expect(page.getByTestId("composer-voice-start")).not.toBeVisible();
});