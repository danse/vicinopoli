import { expect, test } from "@playwright/test";

import { openComposer, publish } from "./helpers";

const uniqueBody = (prefix: string) => `${prefix} ${Date.now()}`;

test("a user can attach a photo and see it in the feed", async ({ page }) => {
  const body = uniqueBody("Foto del quartiere");

  await openComposer(page);
  await page.getByTestId("composer-type-photo").click();
  await page
    .getByTestId("composer-photo")
    .setInputFiles("./test-photo.png");
  await publish(page, body);

  await expect(page.getByText(body)).toBeVisible();
  const item = page.getByRole("listitem").filter({ hasText: body });
  await expect(
    item.getByRole("img", { name: "Foto allegata" }),
  ).toBeVisible();
});