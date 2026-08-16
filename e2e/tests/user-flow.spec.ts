import { expect, test } from "@playwright/test";

import { publish, setAddress } from "./helpers";

test("the root redirects to the address page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/address$/);
  await expect(page.getByTestId("address-submit")).toBeVisible();
});

test("the submit button is disabled until an address is entered", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("address-submit")).toBeDisabled();
  await page.getByTestId("address-input").fill("Via Roma 1, Roma");
  await expect(page.getByTestId("address-submit")).toBeEnabled();
});

test("submitting an address leads to the feed page", async ({ page }) => {
  await setAddress(page, "Via Roma 1, Roma");
  await expect(page.getByTestId("feed-compose")).toBeVisible();
});

test("the feed plus button leads to the composer page", async ({ page }) => {
  await setAddress(page, "Via Roma 1, Roma");
  await page.getByTestId("feed-compose").click();
  await expect(page).toHaveURL(/\/composer$/);
  await expect(page.getByTestId("composer-message")).toBeVisible();
});

test("a full cycle: address, feed, composer, publish, back to feed", async ({
  page,
}) => {
  const body = `Flusso completo ${Date.now()}`;
  await setAddress(page, "Via Roma 1, Roma");
  await page.getByTestId("feed-compose").click();
  await publish(page, body);
  await expect(page.getByText(body)).toBeVisible();
});

test("the feed change-address link returns to the address page", async ({
  page,
}) => {
  await setAddress(page, "Via Roma 1, Roma");
  await page.getByTestId("feed-change-address").click();
  await expect(page).toHaveURL(/\/address$/);
});

test("the address survives a page refresh", async ({ page }) => {
  await setAddress(page, "Via Roma 1, Roma");
  await expect(page.getByTestId("feed-compose")).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/feed$/);
  await expect(page.getByTestId("feed-compose")).toBeVisible();
});

test("feed and composer redirect to the address page when no address is set", async ({
  page,
}) => {
  await page.goto("/feed");
  await expect(page).toHaveURL(/\/address$/);
  await page.goto("/composer");
  await expect(page).toHaveURL(/\/address$/);
});