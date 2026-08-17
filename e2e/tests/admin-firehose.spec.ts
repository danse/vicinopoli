import { expect, test } from "@playwright/test";

import { ADDRESS, seedPosts } from "./helpers";

const ADMIN_BASE = process.env.ADMIN_BASE_URL ?? "http://127.0.0.1:8081";
const PUBLIC_BASE = process.env.PUBLIC_BASE_URL ?? "http://localhost:8080";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "dev-admin-token";

async function reportPost(postId: string, count: number) {
  for (let i = 0; i < count; i++) {
    const response = await fetch(`${PUBLIC_BASE}/api/posts/${postId}/report`, {
      method: "POST",
      headers: { Cookie: `device_id=${crypto.randomUUID()}` },
    });
    expect(response.status).toBe(201);
  }
}

test("the admin firehose asks for the shared token", async ({ page }) => {
  await page.goto(`${ADMIN_BASE}/`);
  await expect(page.getByTestId("admin-token")).toBeVisible();
  await page.getByTestId("admin-login").click();
  await expect(page.getByTestId("admin-error")).toBeVisible();
});

test("a wrong token is rejected", async ({ page }) => {
  await page.goto(`${ADMIN_BASE}/`);
  await page.getByTestId("admin-token").fill("wrong-token");
  await page.getByTestId("admin-login").click();
  await expect(page.getByTestId("admin-error")).toBeVisible();
});

test("an auto-hidden reported post appears in the firehose", async ({
  page,
  request,
}) => {
  const body = `Da controllare ${Date.now()}`;
  const { ids } = await seedPosts(request, ADDRESS, 1, body);
  await reportPost(ids[0], 3);

  await page.goto(`${ADMIN_BASE}/`);
  await page.getByTestId("admin-token").fill(ADMIN_TOKEN);
  await page.getByTestId("admin-login").click();

  const item = page.getByTestId("admin-post").filter({ hasText: body });
  await expect(item).toBeVisible();
  await expect(item.getByTestId("admin-status")).toHaveText("auto_hidden");
  await expect(item.getByTestId("admin-report-count")).toHaveText("3");
  await expect(item.getByTestId("admin-zone-link")).toBeVisible();
});

test("the public feed excludes a post shown as auto-hidden in the firehose", async ({
  page,
  request,
}) => {
  const body = `Nascosta dalla community ${Date.now()}`;
  const { ids } = await seedPosts(request, ADDRESS, 1, body);
  await reportPost(ids[0], 3);

  await page.goto("/");
  await page.getByTestId("address-input").fill(ADDRESS);
  await page.getByTestId("address-submit").click();
  await expect(page.getByTestId("feed-compose")).toBeVisible();
  await expect(page.getByText(body)).not.toBeVisible();
});

test("the zone link opens the public address page with the address pre-filled", async ({
  page,
  request,
}) => {
  const body = `Zona da esplorare ${Date.now()}`;
  await seedPosts(request, ADDRESS, 1, body);

  await page.goto(`${ADMIN_BASE}/`);
  await page.getByTestId("admin-token").fill(ADMIN_TOKEN);
  await page.getByTestId("admin-login").click();

  const item = page.getByTestId("admin-post").filter({ hasText: body });
  await item.getByTestId("admin-zone-link").click();
  await page.waitForURL((url) => url.pathname.endsWith("/address"));

  await expect(page.getByTestId("address-input")).toHaveValue(ADDRESS);
});
