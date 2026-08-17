import { useEffect, useRef } from "react";

import { reverseGeocode } from "@/api/client";

export function geolocationSupported(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      timeout: 10_000,
    });
  });
}

/** Pre-fill the address from the browser location, once per page visit.
 *
 * Resolves the coordinates to a display address via the reverse-geocode
 * endpoint and hands it to ``onFound``. Denied or unavailable geolocation, or
 * a far-away location, silently do nothing. ``enabled`` should be false when
 * an address is already set so a stored address is never overwritten.
 */
export function useBrowserAddress(
  onFound: (address: string) => void,
  enabled: boolean,
): void {
  const attempted = useRef(false);
  const handler = useRef(onFound);
  handler.current = onFound;

  useEffect(() => {
    if (!enabled || attempted.current) return;
    attempted.current = true;
    if (!geolocationSupported()) return;
    getCurrentPosition()
      .then(({ coords }) => reverseGeocode(coords.latitude, coords.longitude))
      .then(({ display_address }) => handler.current(display_address))
      .catch(() => {});
  }, [enabled]);
}
