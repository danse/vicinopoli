/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import { precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { createHandlerBoundToURL } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision?: string }>;
};

precacheAndRoute(self.__WB_MANIFEST);
clientsClaim();

// In injectManifest mode the plugin does not auto-inject the skipWaiting
// handler; without it the update prompt's button sends SKIP_WAITING to a
// worker that ignores it, so "update" never activates the new version.
self.addEventListener("message", (event) => {
  if ((event.data as { type?: string } | undefined)?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Offline navigation fallback for the SPA entry (was `navigateFallback` in
// the old generateSW setup; injectManifest leaves this to the SW itself).
const navigationHandler = createHandlerBoundToURL("/index.html");
registerRoute(
  new NavigationRoute(navigationHandler, {
    denylist: [/^\/api\//, /^\/admin(\.html)?/, /\.(png|svg|ico|webmanifest)$/],
  }),
);

// Push notifications (ADR 0025): the backend sends the post body, voice,
// display address and timestamp; the address is a locale-neutral title.
//
// The handler must never fail silently: a malformed/empty payload or a failed
// showNotification would drop the notification with no trace. We fall back to
// a default title/body so the alert still shows, and forward any error to the
// controlled clients, which report it to Sentry (the SW has no Sentry init).
type PushData = { body?: string; voice?: string; display_address?: string };

function reportPushError(err: unknown): void {
  const error = String(err instanceof Error ? err.message : err);
  self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clients) =>
      clients.forEach((client) =>
        client.postMessage({ type: "vicinopoli:push-error", error }),
      ),
    );
}

self.addEventListener("push", (event) => {
  let data: PushData = {};
  if (event.data) {
    try {
      data = event.data.json() as PushData;
    } catch (err) {
      reportPushError(err);
    }
  }

  const title = data.display_address ?? "vicinopoli";
  const body = data.body ?? data.display_address ?? "vicinopoli";
  const pushEvent = event as PushEvent;
  pushEvent.waitUntil(
    self.registration
      .showNotification(title, {
        body,
        tag: "vicinopoli-post",
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-192x192.png",
        data: { url: "/feed" },
      })
      .catch(reportPushError),
  );
});

self.addEventListener("notificationclick", (event) => {
  const notificationEvent = event as NotificationEvent;
  notificationEvent.notification.close();
  const url = notificationEvent.notification.data?.url ?? "/";
  notificationEvent.waitUntil(self.clients.openWindow(url));
});