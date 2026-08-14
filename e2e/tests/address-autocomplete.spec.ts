import { expect, test } from "@playwright/test";

test("address suggestions appear while typing and fill the input when selected", async ({
  page,
}) => {
  await page.goto("/");

  const input = page.getByTestId("composer-address");
  await input.fill("milano");

  await expect(
    page.getByRole("option", { name: "Milano Centrale, Milano" }),
  ).toBeVisible();

  await page.getByRole("option", { name: "Milano Centrale, Milano" }).click();

  await expect(input).toHaveValue("Milano Centrale, Milano");
});

test("a post made with a selected suggestion reaches the feed", async ({
  page,
}) => {
  const body = `Autocomplete ${Date.now()}`;

  await page.goto("/");

  await page.getByTestId("composer-address").fill("piazza venezia");
  await page.getByRole("option", { name: "Piazza Venezia, Roma" }).click();
  await page.getByTestId("composer-message").fill(body);
  await page.getByRole("button", { name: "Pubblica" }).click();

  await expect(page.getByText(body)).toBeVisible();
});

test("no suggestions are shown for an unknown prefix", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("composer-address").fill("via inesistente");

  await expect(page.getByRole("listbox")).not.toBeVisible();
});
