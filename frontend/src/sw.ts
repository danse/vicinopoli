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
self.addEventListener("push", (event) => {
  const data: { body?: string; voice?: string; display_address?: string } = event.data
    ? (event.data.json() as typeof data)
    : {};

  const title = data.display_address ?? "vicinopoli";
  const body = data.body ?? data.display_address ?? "vicinopoli";
  const pushEvent = event as PushEvent;
  pushEvent.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: "vicinopoli-post",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      data: { url: "/feed" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  const notificationEvent = event as NotificationEvent;
  notificationEvent.notification.close();
  const url = notificationEvent.notification.data?.url ?? "/";
  notificationEvent.waitUntil(self.clients.openWindow(url));
});