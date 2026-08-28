import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { getPushConfig, subscribePush, unsubscribePush } from "@/api/client";

import { Switch } from "@/components/ui/switch";

const ENABLED_KEY = "vicinopoli.pushEnabled";
export const HAS_POSTED_KEY = "vicinopoli.hasPosted";

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
 * Push notifications toggle (ADR 0025), shown in the feed.
 *
 * **On after the first post**: once the device has published a message, the
 * next feed visit attempts to enable push (request the Notification
 * permission, subscribe with the VAPID public key and register the
 * subscription with the current address — only a geohash cell is stored
 * server-side). The permission prompt is withheld from brand-new devices so
 * it does not add to first-visit friction. A denied permission or failed
 * subscription flips the toggle off and remembers the choice, so it is never
 * forced again. Changing address while enabled moves the cell. Failures
 * always surface a short error.
 */
export function PushToggle({ address }: PushToggleProps) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem(ENABLED_KEY) !== "0",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const autoAttempted = useRef(false);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(false);
    try {
      if (
        !("Notification" in window) ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        localStorage.setItem(ENABLED_KEY, "0");
        setEnabled(false);
        setError(true);
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        localStorage.setItem(ENABLED_KEY, "0");
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
      // Revert the optimistic toggle so the switch reflects reality.
      localStorage.setItem(ENABLED_KEY, "0");
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
      localStorage.setItem(ENABLED_KEY, "0");
    } catch {
      // Revert the optimistic toggle so the switch reflects reality.
      localStorage.setItem(ENABLED_KEY, "1");
      setEnabled(true);
      setError(true);
    } finally {
      setBusy(false);
    }
  }, []);

  // Default-on, but only after the device has posted at least once: the
  // notification permission prompt is a first-visit bounce driver, so it is
  // withheld until an explicit engagement signal (the first post). Runs at
  // most once; opting out persists so it never nags again.
  useEffect(() => {
    if (localStorage.getItem(HAS_POSTED_KEY) !== "1") return;
    if (autoAttempted.current) return;
    autoAttempted.current = true;
    if (!enabled || address === "") return;
    const ready = navigator.serviceWorker?.ready;
    if (ready === undefined) return;
    let cancelled = false;
    ready
      .then((registration) => registration.pushManager.getSubscription())
      .then(async (subscription) => {
        if (cancelled || subscription !== null) return;
        await enable();
      })
      .catch(() => {
        // Non-fatal: the switch still lets the user enable manually.
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, address, enable]);

  // Moving house while enabled: tell the backend the new area.
  useEffect(() => {
    if (!enabled || address === "") return;
    const ready = navigator.serviceWorker?.ready;
    if (ready === undefined) return;
    let cancelled = false;
    ready
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
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="flex flex-col gap-0.5">
        <span>{t("push.toggleLabel")}</span>
        {error && (
          <span className="text-xs text-destructive">{t("push.error")}</span>
        )}
      </span>
      <Switch
        data-testid="feed-push-toggle"
        checked={enabled}
        disabled={busy}
        aria-label={t("push.toggleLabel")}
        onCheckedChange={() => {
          // Optimistic: flip immediately so the control feels instant; the
          // async subscribe/unsubscribe runs in the background and reverts
          // the flip on failure.
          setError(false);
          if (enabled) {
            setEnabled(false);
            localStorage.setItem(ENABLED_KEY, "0");
            void disable();
          } else {
            setEnabled(true);
            void enable();
          }
        }}
        className="mt-0.5"
      />
    </div>
  );
}