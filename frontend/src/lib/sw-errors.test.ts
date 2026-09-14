import { beforeEach, describe, expect, it, vi } from "vitest";

import { reportServiceWorkerErrors } from "./sw-errors";

const sentryCapture = vi.fn();
vi.mock("@sentry/react", () => ({
  captureException: (err: unknown, hint?: unknown) => sentryCapture(err, hint),
}));

describe("reportServiceWorkerErrors", () => {
  beforeEach(() => {
    sentryCapture.mockClear();
    // Reset the navigator stub each run.
    Object.defineProperty(window.navigator, "serviceWorker", {
      configurable: true,
      value: { addEventListener: vi.fn() },
    });
  });

  it("reports a push error forwarded from the service worker", () => {
    reportServiceWorkerErrors();
    const addListener = vi.mocked(
      window.navigator.serviceWorker.addEventListener,
    );

    const listener = addListener.mock.calls[0][1] as (
      event: MessageEvent,
    ) => void;
    listener({
      data: { type: "vicinopoli:push-error", error: "showNotification failed" },
    } as MessageEvent);

    expect(sentryCapture).toHaveBeenCalledWith(
      expect.objectContaining({ message: "showNotification failed" }),
      expect.objectContaining({ tags: { source: "push.service-worker" } }),
    );
  });

  it("ignores unrelated messages", () => {
    reportServiceWorkerErrors();
    const listener = vi.mocked(
      window.navigator.serviceWorker.addEventListener,
    ).mock.calls[0][1] as (event: MessageEvent) => void;
    listener({ data: { type: "something-else" } } as MessageEvent);

    expect(sentryCapture).not.toHaveBeenCalled();
  });

  it("is a no-op without a service worker", () => {
    Object.defineProperty(window.navigator, "serviceWorker", {
      configurable: true,
      value: undefined,
    });
    expect(() => reportServiceWorkerErrors()).not.toThrow();
  });
});