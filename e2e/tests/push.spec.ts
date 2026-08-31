import { expect, test } from "@playwright/test";

import { openComposer, publish, setAddress } from "./helpers";

const BASE = process.env.PUBLIC_BASE_URL ?? "http://localhost:8080";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "dev-admin-token";

/**
 * The mock sender (PUSH_SENDER=mock in dev/e2e) POSTs the notification payload
 * to the subscription's endpoint. We subscribe with an endpoint that points at
 * the backend's own admin inbox, so the full pipeline — new post -> reach check
 * -> delivery — is asserted against the running stack without a real push
 * service.
 */
async function inboxUrl(recipient: string) {
  return `http://backend:8000/api/admin/push/inbox?to=${recipient}`;
}

async function readInbox(request: import("@playwright/test").APIRequestContext) {
  const response = await request.get(`${BASE}/api/admin/push/inbox`, {
    headers: { "X-Admin-Token": ADMIN_TOKEN },
  });
  expect(response.status()).toBe(200);
  return (await response.json()) as Array<{
    to: string;
    payload: { body: string; voice: string; display_address: string };
  }>;
}

test("a new post whose reach covers a subscriber is delivered, one that does not is not", async ({
  request,
  playwright,
}) => {
  // Clear any previous deliveries.
  await request.get(`${BASE}/api/admin/push/inbox?clear=1`, {
    headers: { "X-Admin-Token": ADMIN_TOKEN },
  });

  // Device A subscribes from Piazza Venezia (~270m from Via Roma).
  const meA = await request.get("/api/me");
  expect(meA.status()).toBe(200);
  const subscribe = await request.post("/api/push/subscriptions", {
    data: {
      endpoint: await inboxUrl("device-a"),
      p256dh: "cGF5bG9hZA==",
      auth: "YXV0aA==",
      address: "Piazza Venezia, Roma",
    },
  });
  expect(subscribe.status()).toBe(201);

  // Device B posts a ``some`` post (500m reach) at Via Roma: covers A. A
  // separate context so the poster is a different device than the subscriber
  // (otherwise the author's own post is never notified).
  const poster = await playwright.request.newContext({ baseURL: BASE });
  const someBody = `push some ${Date.now()}`;
  await poster.post("/api/posts", {
    data: { address: "Via Roma 1, Roma", body: someBody, voice: "some" },
  });

  await expect
    .poll(async () => {
      const deliveries = await readInbox(request);
      return deliveries.some((d) => d.to === "device-a" && d.payload.body === someBody);
    })
    .toBe(true);

  // A ``street`` post (5m reach) at Via Roma does NOT cover A (~270m away).
  const streetBody = `push street ${Date.now()}`;
  await poster.post("/api/posts", {
    data: { address: "Via Roma 1, Roma", body: streetBody, voice: "street" },
  });

  await expect.poll(async () => {
    const deliveries = await readInbox(request);
    return !deliveries.some((d) => d.to === "device-a" && d.payload.body === streetBody);
  }).toBe(true);

  await poster.dispose();
});

test("the feed toggle subscribes and unsubscribes the device", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["notifications"], { origin: BASE });
  await page.addInitScript(() => {
    // Deterministic: the real browser permission prompt races with the click.
    Notification.requestPermission = async () => "granted";
    const fake = {
      endpoint: `https://push.example.test/sub-${Date.now()}`,
      keys: { p256dh: "cGF5bG9hZA==", auth: "YXV0aA==" },
      getKey(name) {
        // 65-byte p256dh key, 16-byte auth secret (Real browser API).
        if (name === "p256dh") return new Uint8Array(65);
        return new Uint8Array(16);
      },
      async unsubscribe() {
        return true;
      },
    };
    // @ts-expect-error overridden in the page context
    PushManager.prototype.subscribe = async () => fake;
    // @ts-expect-error overridden in the page context
    PushManager.prototype.getSubscription = async () => fake;
  });

  const posted: Array<Record<string, unknown>> = [];
  await page.route("**/api/push/subscriptions", async (route) => {
    const method = route.request().method();
    if (method === "POST" || method === "DELETE") {
      posted.push({
        method,
        body: route.request().postDataJSON(),
      });
    }
    await route.continue();
  });

  await setAddress(page, "Via Roma 1, Roma");

  // The permission prompt is withheld until the device has posted: no
  // auto-subscribe on the first feed visit.
  await expect
    .poll(() => posted.some((p) => p.method === "POST"))
    .toBe(false);

  await openComposer(page);
  await publish(page, `push ${Date.now()}`);

  // After the first post, returning to the feed subscribes automatically.
  await expect
    .poll(() => posted.some((p) => p.method === "POST"))
    .toBe(true);

  const subscribe = posted.find((p) => p.method === "POST");
  expect(subscribe).toBeTruthy();
  const body = subscribe!.body as { address: string; endpoint: string };
  expect(body.address).toBe("Via Roma 1, Roma");
  expect(body.endpoint).toContain("https://push.example.test");

  // The switch reflects the subscribed state and can turn it off...
  await page.getByTestId("feed-push-toggle").click();
  await expect
    .poll(() => posted.some((p) => p.method === "DELETE"))
    .toBe(true);

  // ...and back on.
  await page.getByTestId("feed-push-toggle").click();
  await expect
    .poll(
      () =>
        posted.filter((p) => p.method === "POST").length >= 2 &&
        posted[posted.length - 1]?.method === "POST",
    )
    .toBe(true);
});

test("re-subscribes with a fresh endpoint after the backend drops the subscription", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["notifications"], { origin: BASE });
  await page.addInitScript(() => {
    Notification.requestPermission = async () => "granted";
    const fake = {
      endpoint: `https://push.example.test/sub-${Date.now()}`,
      keys: { p256dh: "cGF5bG9hZA==", auth: "YXV0aA==" },
      getKey(name: "p256dh" | "auth") {
        if (name === "p256dh") return new Uint8Array(65);
        return new Uint8Array(16);
      },
      async unsubscribe() {
        return true;
      },
    };
    // @ts-expect-error overridden in the page context
    PushManager.prototype.subscribe = async () => fake;
    // @ts-expect-error overridden in the page context
    PushManager.prototype.getSubscription = async () => fake;
  });

  const posted: Array<Record<string, unknown>> = [];
  await page.route("**/api/push/subscriptions", async (route) => {
    const method = route.request().method();
    if (method === "POST" || method === "DELETE") {
      posted.push({ method, body: route.request().postDataJSON() });
    }
    await route.continue();
  });

  await setAddress(page, "Via Roma 1, Roma");
  await openComposer(page);
  await publish(page, `push ${Date.now()}`);

  // The first auto-subscribe (after a post) registers endpoint1.
  await expect
    .poll(() => posted.find((p) => p.method === "POST"))
    .toBeTruthy();
  const first = posted.find((p) => p.method === "POST")!.body as {
    endpoint: string;
  };
  const endpoint1 = first.endpoint;

  // Simulate the backend's 404/410 cleanup: drop the row for this device.
  // page.request shares the page's device cookie, so it deletes this device's row.
  const del = await page.request.delete(`${BASE}/api/push/subscriptions`, {
    data: { endpoint: endpoint1 },
  });
  expect(del.status()).toBe(204);

  // Reloading the feed detects the mismatch and re-subscribes with a fresh endpoint.
  await page.reload();
  await expect(page.getByTestId("feed-compose")).toBeVisible();

  await expect
    .poll(() =>
      posted.some(
        (p) =>
          p.method === "POST" &&
          (p.body as { endpoint: string }).endpoint !== endpoint1,
      ),
    )
    .toBe(true);
});