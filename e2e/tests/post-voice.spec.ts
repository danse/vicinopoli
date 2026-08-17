import { expect, test } from "@playwright/test";

import { openComposer, publish } from "./helpers";

const uniqueBody = (prefix: string) => `${prefix} ${Date.now()}`;

test("a user can record a voice message and see it in the feed", async ({
  page,
  context,
}) => {
  const body = uniqueBody("Messaggio vocale");

  // Give the recorder permission without a real microphone: the MediaRecorder
  // will emit silence, which is enough to produce a valid webm blob.
  await context.grantPermissions(["microphone"], { origin: "http://localhost:8080" });

  await openComposer(page);
  await page.getByTestId("composer-type-voice").click();

  await page.getByTestId("composer-voice-start").click();
  await expect(page.getByTestId("composer-voice-stop")).toBeVisible();
  await page.getByTestId("composer-voice-stop").click();

  await publish(page, body);

  await expect(page.getByText(body)).toBeVisible();
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: body })
      .getByLabel("Messaggio vocale allegato"),
  ).toBeVisible();
});