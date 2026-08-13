import { expect, test } from "@playwright/test";

test("readiness probe reports ok when dependencies are reachable", async ({
  request,
}) => {
  const response = await request.get("/readyz");

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.status).toBe("ok");
  expect(body.checks).toEqual({ database: true, object_store: true });
});

test("metrics are exposed for the monitoring stack", async ({ request }) => {
  await request.get("/api/health");

  const response = await request.get("/metrics");

  expect(response.status()).toBe(200);
  const text = await response.text();
  expect(text).toContain("vicinopoli_http_requests_total");
});

test("a single device is rate-limited when posting in a burst (abuse)", async ({
  request,
}) => {
  // Same device via the cookie set by /api/me; the limiter is per-device.
  const me = await request.get("/api/me");
  expect(me.status()).toBe(200);

  const statuses: number[] = [];
  for (let i = 0; i < 8; i++) {
    const response = await request.post("/api/posts", {
      data: {
        address: "Via Roma 1, Roma",
        body: `burst ${i} ${Date.now()}`,
        scope: "building",
      },
    });
    statuses.push(response.status());
  }

  expect(statuses).toContain(429);
  expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
});

test("concurrent feed load stays healthy", async ({ request }) => {
  const results = await Promise.all(
    Array.from({ length: 20 }, () =>
      request.get("/api/feed", {
        params: { address: "Via Roma 1, Roma", target_count: 10 },
      }),
    ),
  );

  for (const response of results) {
    expect(response.status()).toBe(200);
  }
});