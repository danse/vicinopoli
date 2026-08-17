import { expect, test } from "@playwright/test";

import { setAddress } from "./helpers";

test("the address page pre-fills the input from the browser location", async ({
  page,
  context,
}) => {
  // Piazza Venezia's coordinates, as known to the static geocoder.
  await context.grantPermissions(["geolocation"], {
    origin: "http://localhost:8080",
  });
  await context.setGeolocation({ latitude: 41.8957, longitude: 12.4823 });

  await page.goto("/");
  await expect(page).toHaveURL(/\/address$/);

  await expect(page.getByTestId("address-input")).toHaveValue(
    "Piazza Venezia, Roma",
  );
});

test("a pre-filled location can be submitted to reach the feed", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"], {
    origin: "http://localhost:8080",
  });
  await context.setGeolocation({ latitude: 41.8933, longitude: 12.4829 });

  await page.goto("/");
  await expect(page.getByTestId("address-input")).toHaveValue("Via Roma 1, Roma");
  await page.getByTestId("address-submit").click();
  await expect(page).toHaveURL(/\/feed$/);
});

test("an unknown location leaves the address input empty", async ({
  page,
  context,
}) => {
  // In the middle of the ocean: nothing to pre-fill.
  await context.grantPermissions(["geolocation"], {
    origin: "http://localhost:8080",
  });
  await context.setGeolocation({ latitude: 0, longitude: 0 });

  await page.goto("/");
  await expect(page.getByTestId("address-input")).toHaveValue("");
});

test("denied geolocation leaves the address input empty", async ({
  page,
  context,
}) => {
  await context.setGeolocation({ latitude: 41.8957, longitude: 12.4823 });
  // Do not grant the permission: the page must fall back to an empty input.

  await page.goto("/");
  await expect(page.getByTestId("address-input")).toHaveValue("");
});

test("an already-stored address is not overwritten by geolocation", async ({
  page,
  context,
}) => {
  await setAddress(page, "Milano Centrale, Milano");
  await page.getByTestId("feed-change-address").click();
  await expect(page).toHaveURL(/\/address$/);

  // New location would resolve to Piazza Venezia, but the stored address must
  // stay untouched.
  await context.setGeolocation({ latitude: 41.8957, longitude: 12.4823 });
  await page.reload();
  await expect(page.getByTestId("address-input")).toHaveValue(
    "Milano Centrale, Milano",
  );
});
