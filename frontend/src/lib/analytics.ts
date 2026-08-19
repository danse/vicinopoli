/** Google Ads (gtag.js) tracking, consent-gated (ADR 0026).
 *
 * The tag only loads when a non-empty ``VITE_GTAG_ID`` is baked in at build
 * time (empty in dev/test/e2e, so this whole module is inert there). Consent
 * Mode v2 defaults every signal to ``denied``; the GDPR consent banner grants
 * them on opt-in. SPA route changes send ``page_view`` config calls.
 */

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
  }
}

type ConsentSignal = "granted" | "denied";

const DENIED: Record<string, ConsentSignal> = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
};

function state(granted: boolean): Record<string, ConsentSignal> {
  const value: ConsentSignal = granted ? "granted" : "denied";
  return {
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
  };
}

let loaded = false;

function ensureGtag(id: string): void {
  window.dataLayer = window.dataLayer ?? [];
  const gtag = (...args: unknown[]) => window.dataLayer!.push(args);
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("consent", "default", DENIED);
  gtag("config", id, { send_page_view: false });
}

/** Inject the gtag script and configure the tag with consent default denied. */
export function initGtag(id = import.meta.env.VITE_GTAG_ID ?? ""): void {
  if (loaded || id === "" || typeof window === "undefined") return;
  loaded = true;
  const existing = document.querySelector(
    'script[src^="https://www.googletagmanager.com/gtag/js"]',
  );
  if (existing === null) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(script);
  }
  ensureGtag(id);
}

/** Reflect the GDPR consent choice into the tag's consent signals. */
export function setConsent(
  granted: boolean,
  id = import.meta.env.VITE_GTAG_ID ?? "",
): void {
  if (id === "" || typeof window === "undefined") return;
  window.gtag?.("consent", "update", state(granted));
}

/** Report an SPA route change so Ads attribution sees real paths. */
export function trackPageView(
  path: string,
  id = import.meta.env.VITE_GTAG_ID ?? "",
): void {
  if (id === "" || typeof window === "undefined") return;
  window.gtag?.("config", id, { page_path: path });
}

/** Feed-page view conversion (Google Ads). */
const FEED_CONVERSION_ID = "AW-18396502888/fiC1CP7z0eMcEOi2kcRE";

export function trackConversion(
  id = import.meta.env.VITE_GTAG_ID ?? "",
): void {
  if (id === "" || typeof window === "undefined") return;
  window.gtag?.("event", "conversion", {
    send_to: FEED_CONVERSION_ID,
    value: 1.0,
    currency: "views",
  });
}
