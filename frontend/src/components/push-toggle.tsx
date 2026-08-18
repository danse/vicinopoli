import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { getPushConfig, subscribePush, unsubscribePush } from "@/api/client";

const ENABLED_KEY = "vicinopoli.pushEnabled";

function urlBase64ToUint8Array(base64url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

interface PushSubscriptionWire {
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function encodeSubscription(
  subscription: PushSubscription,
): Promise<PushSubscriptionWire> {
  const p256dh = subscription.getKey("p256dh");
  const auth = subscription.getKey("auth");
  if (p256dh === null || auth === null) {
    throw new Error("subscription keys missing");
  }
  return {
    endpoint: subscription.endpoint,
    p256dh: toBase64Url(p256dh),
    auth: toBase64Url(auth),
  };
}

interface PushToggleProps {
  address: string;
}

/**
 * Opt-in/out toggle for push notifications (ADR 0025), shown in the feed.
 *
 * Enabling requests the Notification permission, subscribes with the VAPID
 * public key and registers the subscription with the current address (only a
 * geohash cell is stored server-side). Changing address while enabled moves
 * the cell. All failures keep the toggle off and surface a short error.
 */
export function PushToggle({ address }: PushToggleProps) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem(ENABLED_KEY) === "1",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(false);
    try {
      if (
        !("Notification" in window) ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        setEnabled(false);
        setError(true);
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setEnabled(false);
        setError(true);
        return;
      }
      const [config, registration] = await Promise.all([
        getPushConfig(),
        navigator.serviceWorker.ready,
      ]);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.vapid_public_key),
      });
      await subscribePush({ ...(await encodeSubscription(subscription)), address });
      localStorage.setItem(ENABLED_KEY, "1");
    } catch {
      // Revert the optimistic toggle so the checkbox reflects reality.
      setEnabled(false);
      setError(true);
    } finally {
      setBusy(false);
    }
  }, [address]);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(false);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription !== null) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await unsubscribePush(endpoint);
      }
      localStorage.removeItem(ENABLED_KEY);
    } catch {
      // Revert the optimistic toggle so the checkbox reflects reality.
      setEnabled(true);
      setError(true);
    } finally {
      setBusy(false);
    }
  }, []);

  // Moving house while enabled: tell the backend the new area.
  useEffect(() => {
    if (!enabled || address === "") return;
    let cancelled = false;
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then(async (subscription) => {
        if (subscription === null || cancelled) return;
        await subscribePush({
          ...(await encodeSubscription(subscription)),
          address,
        });
      })
      .catch(() => {
        // Non-fatal: the next feed load retries.
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, address]);

  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <input
        type="checkbox"
        data-testid="feed-push-toggle"
        checked={enabled}
        disabled={busy}
        onChange={() => {
          // Optimistic: flip immediately so the control feels instant; the
          // async subscribe/unsubscribe runs in the background and reverts
          // the flip on failure.
          setError(false);
          if (enabled) {
            setEnabled(false);
            localStorage.removeItem(ENABLED_KEY);
            void disable();
          } else {
            setEnabled(true);
            void enable();
          }
        }}
        className="mt-0.5 h-4 w-4 accent-foreground"
      />
      <span className="flex flex-col gap-0.5">
        <span>{t("push.toggleLabel")}</span>
        {error && (
          <span className="text-xs text-destructive">{t("push.error")}</span>
        )}
      </span>
    </label>
  );
}