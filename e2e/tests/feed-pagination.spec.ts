import { expect, test } from "@playwright/test";

import { ADDRESS, seedPosts, setAddress } from "./helpers";

test("the feed loads a first page and loads more on scroll", async ({
  page,
  request,
}) => {
  // The suite starts from a cleared DB, so this spec seeds its own posts to
  // guarantee more than one page exists at the address. Each post comes from a
  // fresh device so the per-device post rate limit is never hit.
  await seedPosts(request, ADDRESS, 22);

  await setAddress(page, ADDRESS);

  const firstPage = page.getByTestId("feed-post");
  await expect(firstPage.first()).toBeVisible();

  const initial = await firstPage.count();
  expect(initial).toBeGreaterThan(0);
  expect(initial).toBeLessThanOrEqual(10);

  await page.getByTestId("feed-load-more").scrollIntoViewIfNeeded();

  await expect(firstPage).toHaveCount(initial + 10);
});
