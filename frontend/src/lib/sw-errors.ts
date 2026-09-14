import * as Sentry from "@sentry/react";

const PUSH_ERROR_TYPE = "vicinopoli:push-error";

/**
 * Forward service-worker errors to Sentry.
 *
 * The service worker has no Sentry init, so it posts structured messages to
 * its controlled clients; this listener reports them with the app's own
 * Sentry instance. Register once on startup (main.tsx).
 */
export function reportServiceWorkerErrors(): void {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
  navigator.serviceWorker.addEventListener("message", (event: MessageEvent) => {
    const data = event.data as { type?: string; error?: string } | undefined;
    if (data?.type !== PUSH_ERROR_TYPE || !data.error) return;
    Sentry.captureException(new Error(data.error), {
      tags: { source: "push.service-worker" },
    });
  });
}