import { expect, test } from "@playwright/test";

const uniqueBody = (prefix: string) => `${prefix} ${Date.now()}`;

test("a user can attach a photo and see it in the feed", async ({ page }) => {
  const body = uniqueBody("Foto del quartiere");

  await page.goto("/");

  await page.getByTestId("composer-address").fill("Via Roma 1, Roma");
  await page.getByTestId("composer-message").fill(body);
  await page
    .getByTestId("composer-photo")
    .setInputFiles("./test-photo.png");
  await page.getByRole("button", { name: "Pubblica" }).click();

  await expect(page.getByText(body)).toBeVisible();
  const item = page
    .getByRole("listitem")
    .filter({ hasText: body });
  await expect(
    item.getByRole("img", { name: "Foto allegata" }),
  ).toBeVisible();
});