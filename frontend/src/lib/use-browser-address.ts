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

/** Resolve the browser location to a display address.
 *
 * Opt-in only: called when the user asks for their location (the address page
 * "use my location" button), never automatically. Rejects on denied or
 * unavailable geolocation, or when the reverse geocode finds nothing.
 */
export async function locateAddress(): Promise<string> {
  const { coords } = await getCurrentPosition();
  const { display_address } = await reverseGeocode(
    coords.latitude,
    coords.longitude,
  );
  return display_address;
}