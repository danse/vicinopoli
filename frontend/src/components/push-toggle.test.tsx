import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "../i18n";
import { HAS_POSTED_KEY, PushToggle } from "./push-toggle";

const api = vi.hoisted(() => ({
  getPushConfig: vi.fn().mockResolvedValue({
    vapid_public_key: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  }),
  subscribePush: vi.fn().mockResolvedValue(undefined),
  unsubscribePush: vi.fn().mockResolvedValue(undefined),
  getPushSubscriptions: vi.fn().mockResolvedValue({
    endpoints: ["https://push.example.test/sub/abc"],
  }),
}));

vi.mock("@/api/client", () => ({
  getPushConfig: api.getPushConfig,
  subscribePush: api.subscribePush,
  unsubscribePush: api.unsubscribePush,
  getPushSubscriptions: api.getPushSubscriptions,
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
  const { subscribed = false, permission = "granted" } = overrides;
  const subscription = stubSubscription();
  let active = subscribed;
  const registration = {
    pushManager: {
      subscribe: vi.fn().mockImplementation(async () => {
        active = true;
        return subscription;
      }),
      getSubscription: vi.fn().mockImplementation(async () =>
        active ? subscription : null,
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

const address = "Via Roma 1, Roma";

describe("PushToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    api.getPushConfig.mockClear();
    api.subscribePush.mockClear();
    api.unsubscribePush.mockClear();
    api.getPushSubscriptions.mockClear();
  });

  it("does not auto-subscribe before the device has posted", async () => {
    stubBrowser();
    render(<PushToggle address={address} />);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(api.subscribePush).not.toHaveBeenCalled();
  });

  it("subscribes on the first visit after a post", async () => {
    stubBrowser();
    localStorage.setItem(HAS_POSTED_KEY, "1");
    render(<PushToggle address={address} />);
    const toggle = screen.getByTestId("feed-push-toggle");
    await waitFor(() => expect(api.subscribePush).toHaveBeenCalled());
    expect(toggle).toBeChecked();
    expect(api.subscribePush).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "https://push.example.test/sub/abc",
        p256dh: expect.any(String),
        auth: expect.any(String),
        address,
      }),
    );
    expect(localStorage.getItem("vicinopoli.pushEnabled")).toBe("1");
  });

  it("respects a previous opt-out and never nags again", async () => {
    stubBrowser();
    localStorage.setItem(HAS_POSTED_KEY, "1");
    localStorage.setItem("vicinopoli.pushEnabled", "0");
    render(<PushToggle address={address} />);
    expect(screen.getByTestId("feed-push-toggle")).not.toBeChecked();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(api.subscribePush).not.toHaveBeenCalled();
  });

  it("re-syncs the server-side cell when already subscribed", async () => {
    stubBrowser({ subscribed: true });
    localStorage.setItem("vicinopoli.pushEnabled", "1");
    render(<PushToggle address={address} />);
    await waitFor(() =>
      expect(api.subscribePush).toHaveBeenCalledWith(
        expect.objectContaining({ address }),
      ),
    );
    expect(screen.getByTestId("feed-push-toggle")).toBeChecked();
  });

  it("re-subscribes with a fresh endpoint when the backend dropped the subscription", async () => {
    const { subscription } = stubBrowser({ subscribed: true });
    localStorage.setItem("vicinopoli.pushEnabled", "1");
    api.getPushSubscriptions.mockResolvedValue({ endpoints: [] });
    render(<PushToggle address={address} />);
    await waitFor(() => expect(subscription.unsubscribe).toHaveBeenCalled());
    await waitFor(() => expect(api.subscribePush).toHaveBeenCalled());
    expect(screen.getByTestId("feed-push-toggle")).toBeChecked();
  });

  it("flips off and remembers the choice when permission is denied", async () => {
    stubBrowser({ permission: "denied" });
    localStorage.setItem(HAS_POSTED_KEY, "1");
    render(<PushToggle address={address} />);
    const toggle = screen.getByTestId("feed-push-toggle");
    await waitFor(() => expect(toggle).not.toBeChecked());
    expect(api.subscribePush).not.toHaveBeenCalled();
    expect(localStorage.getItem("vicinopoli.pushEnabled")).toBe("0");
    expect(
      await screen.findByText(/Impossibile attivare le notifiche/),
    ).toBeInTheDocument();
  });

  it("flips off and remembers the choice when the config call fails", async () => {
    stubBrowser();
    localStorage.setItem(HAS_POSTED_KEY, "1");
    api.getPushConfig.mockRejectedValueOnce(new Error("boom"));
    render(<PushToggle address={address} />);
    const toggle = screen.getByTestId("feed-push-toggle");
    await waitFor(() => expect(toggle).not.toBeChecked());
    expect(localStorage.getItem("vicinopoli.pushEnabled")).toBe("0");
    expect(
      await screen.findByText(/Impossibile attivare le notifiche/),
    ).toBeInTheDocument();
  });

  it("unsubscribes locally and on the server when disabled", async () => {
    stubBrowser();
    localStorage.setItem(HAS_POSTED_KEY, "1");
    render(<PushToggle address={address} />);
    await waitFor(() => expect(api.subscribePush).toHaveBeenCalled());
    const toggle = screen.getByTestId("feed-push-toggle");
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(api.unsubscribePush).toHaveBeenCalledWith(
        "https://push.example.test/sub/abc",
      ),
    );
    expect(toggle).not.toBeChecked();
    expect(localStorage.getItem("vicinopoli.pushEnabled")).toBe("0");
  });

  it("moves the server-side cell when the address changes while enabled", async () => {
    stubBrowser();
    localStorage.setItem(HAS_POSTED_KEY, "1");
    const { rerender } = render(<PushToggle address={address} />);
    await waitFor(() =>
      expect(api.subscribePush).toHaveBeenCalledWith(
        expect.objectContaining({ address }),
      ),
    );
    rerender(<PushToggle address="Via Milano 9, Milano" />);
    await waitFor(() =>
      expect(api.subscribePush).toHaveBeenCalledWith(
        expect.objectContaining({ address: "Via Milano 9, Milano" }),
      ),
    );
  });
});