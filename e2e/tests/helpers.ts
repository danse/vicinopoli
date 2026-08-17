import { expect, type Page } from "@playwright/test";

export const ADDRESS = "Via Roma 1, Roma";

export async function setAddress(page: Page, address: string) {
  await page.goto("/");
  await page.getByTestId("address-input").fill(address);
  await page.getByTestId("address-submit").click();
  await expect(page).toHaveURL(/\/feed$/);
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