import { expect, test } from "@playwright/test";

import { openComposer, publish, setPseudonym } from "./helpers";

const uniqueBody = (prefix: string) => `${prefix} ${Date.now()}`;

test("a user can post a text message and see it in the feed", async ({
  page,
}) => {
  const body = uniqueBody("Ciao vicine");

  await openComposer(page);
  await publish(page, body);

  await expect(page.getByText(body)).toBeVisible();
});

test("a user can choose a pseudonym and it appears as the post author", async ({
  page,
}) => {
  const body = uniqueBody("Ciao a tutte");
  const pseudonym = `Gina${Date.now() % 10000}`;

  await openComposer(page);
  await setPseudonym(page, pseudonym);
  await publish(page, body);

  await expect(page.getByText(body)).toBeVisible();
  await expect(page.getByText(pseudonym)).toBeVisible();
});

test("the composer shows the current pseudonym and a link to change it", async ({
  page,
}) => {
  await openComposer(page);
  await setPseudonym(page, "Gina");

  await expect(page.getByText("Pubblicando come Gina")).toBeVisible();
  await page.getByTestId("composer-change-pseudonym").click();
  await expect(page).toHaveURL(/\/pseudonym$/);
});