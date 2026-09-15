/**
 * Google Ads click-param preservation (gclid / wbraid / gad_*).
 *
 * An ad click lands with a `gclid` in the URL, but SPA navigation drops query
 * params before the feed conversion fires. gtag can then no longer link the
 * conversion to the click. We capture the params once at startup and re-attach
 * them to the URL just before the conversion event, so attribution survives.
 */

const AD_PARAM_NAMES = ["gclid", "wbraid", "gad_source", "gad_campaignid"] as const;

let captured = new URLSearchParams();

/** Extract only the Google Ads click params from a search string. */
export function adParamsFromSearch(search: string): string {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  const ad = new URLSearchParams();
  for (const name of AD_PARAM_NAMES) {
    const value = params.get(name);
    if (value !== null) ad.set(name, value);
  }
  return ad.toString();
}

/** Remember the ad-click params from the landing URL for the SPA session. */
export function captureAdClickParams(): void {
  captured = new URLSearchParams(adParamsFromSearch(window.location.search));
}

/** Re-attach the captured ad params to the current URL so gtag can link a
 * conversion to the original ad click. */
export function restoreAdClickParams(): void {
  if (captured.size === 0) return;
  const url = new URL(window.location.href);
  let changed = false;
  for (const [name, value] of captured) {
    if (!url.searchParams.has(name)) {
      url.searchParams.set(name, value);
      changed = true;
    }
  }
  if (changed) {
    window.history.replaceState({}, "", `${url.pathname}?${url.searchParams}`);
  }
}