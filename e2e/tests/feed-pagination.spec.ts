import { expect, test } from "@playwright/test";

import { ADDRESS, setAddress } from "./helpers";

test("the feed loads a first page and loads more on scroll", async ({
  page,
}) => {
  await setAddress(page, ADDRESS);

  const firstPage = page.getByTestId("feed-post");
  await expect(firstPage.first()).toBeVisible();

  const initial = await firstPage.count();
  expect(initial).toBeGreaterThan(0);
  expect(initial).toBeLessThanOrEqual(10);

  await page.getByTestId("feed-load-more").scrollIntoViewIfNeeded();

  await expect(firstPage).toHaveCount(initial + 10);
});
