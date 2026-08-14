import { expect, test } from "@playwright/test";

test("API health returns ok through the reverse proxy", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body.status).toBe("ok");
  expect(body.app).toBe("vicinopoli");
});

test("the PWA shell is served and renders the app title", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "vicinopoli" })).toBeVisible();
});

test("the PWA shell shows a build version in the footer", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("app-footer")).toBeVisible();
  await expect(page.getByTestId("app-footer-version")).toHaveText(
    /^(dev|[0-9a-f]{7,})$/,
  );
});
