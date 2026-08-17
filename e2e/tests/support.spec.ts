import { expect, test } from "@playwright/test";

test("the footer links to a support page with the support email", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByTestId("footer-support")).toBeVisible();
  await page.getByTestId("footer-support").click();
  await expect(page).toHaveURL(/\/support$/);
  await expect(page.getByTestId("support-email")).toHaveText(
    /^info@[^@\s]+$/,
  );
});

test("the support page shows the support email as a mailto link", async ({
  page,
}) => {
  await page.goto("/support");

  await expect(page.getByTestId("support-email")).toBeVisible();
  const href = await page.getByTestId("support-email").getAttribute("href");
  expect(href).toMatch(/^mailto:info@[^@\s]+$/);
});