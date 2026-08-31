import { expect, test } from "@playwright/test";

import { setAddress } from "./helpers";

test("the privacy and cookie policy page loads from the footer link", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("footer-privacy").click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByTestId("privacy-page")).toBeVisible();
  await expect(page.getByTestId("privacy-email")).toHaveAttribute(
    "href",
    /^mailto:/,
  );
});

test("the consent banner links to the privacy policy", async ({ page }) => {
  await setAddress(page, "Via Roma 1, Roma");

  const policyLink = page.getByTestId("consent-policy-link");
  await expect(policyLink).toBeVisible();
  await policyLink.click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByTestId("privacy-page")).toBeVisible();
});