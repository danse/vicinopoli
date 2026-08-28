import { expect, test } from "@playwright/test";

import { publish, setAddress } from "./helpers";

test("a never-posted device sees the compose ring until it publishes", async ({
  page,
}) => {
  await setAddress(page, "Via Roma 1, Roma");
  const fab = page.getByTestId("feed-compose");
  await expect(fab).toHaveClass(/fab-nudge/);

  await fab.click();
  await expect(page).toHaveURL(/\/composer$/);
  await publish(page, `primo post ${Date.now()}`);

  await expect(page.getByTestId("feed-compose")).not.toHaveClass(/fab-nudge/);
});