import { expect, test } from "@playwright/test";

import { publish, setAddress } from "./helpers";

const YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

test("a post with a link renders the link in the text and a preview card", async ({
  page,
}) => {
  await setAddress(page, "Via Roma 1, Roma");
  await page.getByTestId("feed-compose").click();
  await publish(page, `Guarda questo ${YOUTUBE_URL}`);

  const inlineLink = page.getByTestId("post-link").first();
  await expect(inlineLink).toBeVisible();
  await expect(inlineLink).toHaveAttribute("href", YOUTUBE_URL);

  const card = page.getByTestId("link-preview").first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card).toHaveAttribute("href", YOUTUBE_URL);
});

test("a post with a very long URL does not overflow horizontally", async ({
  page,
}) => {
  const longUrl = `https://example.com/${"a".repeat(300)}`;
  await setAddress(page, "Via Roma 1, Roma");
  await page.getByTestId("feed-compose").click();
  await publish(page, `link ${longUrl}`);

  const inlineLink = page.getByTestId("post-link").first();
  await expect(inlineLink).toBeVisible();
  await expect(inlineLink).toHaveText(longUrl);

  const fits = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(fits).toBe(true);
});