import { expect, test } from "@playwright/test";

import { openComposer, publish, publishWithoutText } from "./helpers";

const uniqueBody = (prefix: string) => `${prefix} ${Date.now()}`;

test("a user can attach a photo and see it in the feed", async ({ page }) => {
  const body = uniqueBody("Foto del quartiere");

  await openComposer(page);
  await page.getByTestId("composer-type-photo").click();
  await page
    .getByTestId("composer-photo")
    .setInputFiles("./test-photo.png");
  await publish(page, body, "caption");

  await expect(page.getByText(body)).toBeVisible();
  const item = page.getByRole("listitem").filter({ hasText: body });
  const image = item.getByRole("img", { name: "Foto allegata" });
  await expect(image).toBeVisible();

  // The image takes all the horizontal space within the message.
  const itemBox = (await item.boundingBox())!;
  const imageBox = (await image.boundingBox())!;
  expect(imageBox.width).toBeGreaterThan(itemBox.width * 0.9);
});

test("a picture can be published without any text", async ({ page }) => {
  await openComposer(page);
  await page.getByTestId("composer-type-photo").click();
  await page.getByTestId("composer-photo").setInputFiles("./test-photo.png");
  await publishWithoutText(page);

  await expect(
    page.getByRole("img", { name: "Foto allegata" }).first(),
  ).toBeVisible();
});