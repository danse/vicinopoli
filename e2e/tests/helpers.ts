import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const ADDRESS = "Via Roma 1, Roma";

export async function setAddress(page: Page, address: string) {
  await page.goto("/address");
  await page.getByTestId("address-input").fill(address);
  await page.getByTestId("address-submit").click();
  await expect(page).toHaveURL(/\/feed$/);
}

/**
 * Seed ``count`` posts at ``address`` via the API, each from a fresh device.
 *
 * The stack rate-limits posting to 5/min per device, so every post uses a brand
 * new ``device_id`` cookie (the backend mints a new device for an unknown id)
 * and never trips the limiter.
 */
export async function seedPosts(
  request: APIRequestContext,
  address: string,
  count: number,
  body?: string,
) {
  const bodies: string[] = [];
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const text = body ?? `seed ${i} ${Date.now()}`;
    const response = await request.post("/api/posts", {
      data: { address, body: text },
      headers: { Cookie: `device_id=${crypto.randomUUID()}` },
    });
    expect(response.status()).toBe(201);
    bodies.push(text);
    ids.push((await response.json()).id as string);
  }
  return { bodies, ids };
}

export async function openComposer(page: Page, address: string = ADDRESS) {
  await setAddress(page, address);
  await page.getByTestId("feed-compose").click();
  await expect(page).toHaveURL(/\/composer$/);
}

export async function setPseudonym(page: Page, pseudonym: string) {
  await page.getByTestId("composer-change-pseudonym").click();
  await expect(page).toHaveURL(/\/pseudonym$/);
  await page.getByTestId("pseudonym-input").fill(pseudonym);
  await page.getByTestId("pseudonym-submit").click();
  await expect(page).toHaveURL(/\/composer$/);
}

export async function publish(page: Page, body: string, field?: "message" | "caption") {
  await page.getByTestId(`composer-${field ?? "message"}`).fill(body);
  await page.getByRole("button", { name: "Pubblica" }).click();
  await expect(page).toHaveURL(/\/feed$/);
}

export async function publishWithoutText(page: Page) {
  await page.getByRole("button", { name: "Pubblica" }).click();
  await expect(page).toHaveURL(/\/feed$/);
}