import { expect, test } from "@playwright/test";

import { openComposer, publish } from "./helpers";

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
  await openComposer(page);
  await publish(page, body);

  await expect(page.getByText(body)).toBeVisible();
});