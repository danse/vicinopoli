import { expect, test } from "@playwright/test";

const uniqueBody = (prefix: string) => `${prefix} ${Date.now()}`;

test("a user can record a voice message and see it in the feed", async ({
  page,
  context,
}) => {
  const body = uniqueBody("Messaggio vocale");

  // Give the recorder permission without a real microphone: the MediaRecorder
  // will emit silence, which is enough to produce a valid webm blob.
  await context.grantPermissions(["microphone"], { origin: "http://localhost:8080" });

  await page.goto("/");

  await page.getByLabel("Il tuo indirizzo").fill("Via Roma 1, Roma");
  await page.getByLabel("Scrivi un messaggio").fill(body);
  await page.getByRole("button", { name: "Registra voce" }).click();
  await expect(page.getByRole("button", { name: "Ferma" })).toBeVisible();
  await page.getByRole("button", { name: "Ferma" }).click();

  await page.getByRole("button", { name: "Pubblica" }).click();

  await expect(page.getByText(body)).toBeVisible();
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: body })
      .getByLabel("Messaggio vocale allegato"),
  ).toBeVisible();
});