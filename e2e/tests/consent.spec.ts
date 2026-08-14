import { expect, test } from "@playwright/test";

test("a new visitor sees the consent banner and can decline", async ({
  page,
  context,
}) => {
  await context.clearCookies();
  await page.goto("/");

  await expect(
    page.getByRole("button", { name: "Accetta" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Rifiuta" }).click();

  await expect(
    page.getByRole("button", { name: "Accetta" }),
  ).not.toBeVisible();
});

test("accepting consent records onboarding and lets the user post", async ({
  page,
  context,
}) => {
  await context.clearCookies();
  await page.goto("/");

  await page.getByRole("button", { name: "Accetta" }).click();
  await expect(
    page.getByRole("button", { name: "Accetta" }),
  ).not.toBeVisible();

  const body = `Messaggio consenso ${Date.now()}`;
  await page.getByTestId("composer-address").fill("Via Roma 1, Roma");
  await page.getByTestId("composer-message").fill(body);
  await page.getByRole("button", { name: "Pubblica" }).click();

  await expect(page.getByText(body)).toBeVisible();
});