import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "../i18n";
import { PushToggle } from "./push-toggle";

const api = vi.hoisted(() => ({
  getPushConfig: vi.fn().mockResolvedValue({
    vapid_public_key: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  }),
  subscribePush: vi.fn().mockResolvedValue(undefined),
  unsubscribePush: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/api/client", () => ({
  getPushConfig: api.getPushConfig,
  subscribePush: api.subscribePush,
  unsubscribePush: api.unsubscribePush,
}));

function stubSubscription() {
  return {
    endpoint: "https://push.example.test/sub/abc",
    getKey: (name: "p256dh" | "auth"): ArrayBuffer => {
      if (name === "p256dh") return new Uint8Array(65).buffer;
      return new Uint8Array(16).buffer;
    },
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
}

function stubBrowser(overrides: {
  subscribed?: boolean;
  permission?: string;
} = {}) {
  const { subscribed = true, permission = "granted" } = overrides;
  const subscription = stubSubscription();
  const registration = {
    pushManager: {
      subscribe: vi.fn().mockResolvedValue(subscription),
      getSubscription: vi.fn().mockResolvedValue(
        subscribed ? subscription : null,
      ),
    },
  };
  vi.stubGlobal(
    "Notification",
    { requestPermission: vi.fn().mockResolvedValue(permission) },
  );
  vi.stubGlobal("PushManager", class {});
  Object.defineProperty(window.navigator, "serviceWorker", {
    value: { ready: Promise.resolve(registration) },
    configurable: true,
  });
  return { registration, subscription };
}

async function enableToggle() {
  const checkbox = screen.getByTestId("feed-push-toggle");
  fireEvent.click(checkbox);
  await waitFor(() => expect(api.subscribePush).toHaveBeenCalled());
}

describe("PushToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    api.getPushConfig.mockClear();
    api.subscribePush.mockClear();
    api.unsubscribePush.mockClear();
  });

  it("registers the subscription with the current address when enabled", async () => {
    stubBrowser();
    render(<PushToggle address="Via Roma 1, Roma" />);
    const checkbox = screen.getByTestId("feed-push-toggle");
    expect(checkbox).not.toBeChecked();
    await enableToggle();
    expect(checkbox).toBeChecked();
    expect(api.getPushConfig).toHaveBeenCalledTimes(1);
    expect(api.subscribePush).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "https://push.example.test/sub/abc",
        p256dh: expect.any(String),
        auth: expect.any(String),
        address: "Via Roma 1, Roma",
      }),
    );
  });

  it("stays disabled and explains when permission is denied", async () => {
    stubBrowser({ permission: "denied" });
    render(<PushToggle address="Via Roma 1, Roma" />);
    const checkbox = screen.getByTestId("feed-push-toggle");
    fireEvent.click(checkbox);
    await waitFor(() => expect(checkbox).not.toBeChecked());
    expect(api.subscribePush).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/Impossibile attivare le notifiche/),
    ).toBeInTheDocument();
  });

  it("unsubscribes locally and on the server when disabled", async () => {
    stubBrowser();
    render(<PushToggle address="Via Roma 1, Roma" />);
    const checkbox = screen.getByTestId("feed-push-toggle");
    await enableToggle();
    fireEvent.click(checkbox);
    await waitFor(() =>
      expect(api.unsubscribePush).toHaveBeenCalledWith(
        "https://push.example.test/sub/abc",
      ),
    );
    expect(checkbox).not.toBeChecked();
  });

  it("moves the server-side cell when the address changes while enabled", async () => {
    stubBrowser();
    const { rerender } = render(<PushToggle address="Via Roma 1, Roma" />);
    await enableToggle();
    rerender(<PushToggle address="Via Milano 9, Milano" />);
    await waitFor(() =>
      expect(api.subscribePush).toHaveBeenCalledWith(
        expect.objectContaining({ address: "Via Milano 9, Milano" }),
      ),
    );
  });

  it("surfaces an error instead of enabling when the config call fails", async () => {
    stubBrowser();
    api.getPushConfig.mockRejectedValueOnce(new Error("boom"));
    render(<PushToggle address="Via Roma 1, Roma" />);
    fireEvent.click(screen.getByTestId("feed-push-toggle"));
    const checkbox = screen.getByTestId("feed-push-toggle");
    expect(
      await screen.findByText(/Impossibile attivare le notifiche/),
    ).toBeInTheDocument();
    await waitFor(() => expect(checkbox).not.toBeChecked());
  });
});
