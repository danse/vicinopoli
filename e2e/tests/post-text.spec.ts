import { expect, test } from "@playwright/test";

import { openComposer, publish } from "./helpers";

const uniqueBody = (prefix: string) => `${prefix} ${Date.now()}`;

test("a user can post a text message and see it in the feed", async ({
  page,
}) => {
  const body = uniqueBody("Ciao vicini");

  await openComposer(page);
  await publish(page, body);

  await expect(page.getByText(body)).toBeVisible();
});

test("a user can choose a pseudonym and it appears as the post author", async ({
  page,
}) => {
  const body = uniqueBody("Ciao a tutti");
  const pseudonym = `Gino${Date.now() % 10000}`;

  await openComposer(page);
  await publish(page, body, { pseudonym });

  await expect(page.getByText(body)).toBeVisible();
  await expect(page.getByText(pseudonym)).toBeVisible();
});