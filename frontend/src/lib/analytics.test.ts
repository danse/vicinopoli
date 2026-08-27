import { beforeEach, describe, expect, it, vi } from "vitest";

const ID = "AW-18396502888";

let analytics: typeof import("./analytics");

beforeEach(async () => {
  // Reset the module so the internal "already loaded" flag starts fresh.
  vi.resetModules();
  analytics = await import("./analytics");
  delete (window as { dataLayer?: unknown[] }).dataLayer;
  delete (window as { gtag?: unknown }).gtag;
  document.head.innerHTML = "";
});

function dataLayerArgs(): unknown[][] {
  return ((window.dataLayer ?? []) as unknown[][]).slice();
}

function lastCall(): unknown[] {
  const calls = dataLayerArgs();
  return calls[calls.length - 1];
}

function scriptTags(): string[] {
  return Array.from(document.querySelectorAll("script")).map((s) => s.src);
}

describe("analytics (Google Ads gtag)", () => {
  it("loads the gtag script, dataLayer and config only when an id is set", () => {
    analytics.initGtag(ID);
    expect(window.dataLayer).toBeDefined();
    const calls = dataLayerArgs();
    expect(calls[0]).toEqual(["js", expect.any(Date)]);
    expect(calls[1]).toEqual([
      "consent",
      "default",
      {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      },
    ]);
    expect(calls[2]).toEqual(["config", ID, { send_page_view: false }]);
    expect(
      scriptTags().some((src) =>
        src.startsWith("https://www.googletagmanager.com/gtag/js"),
      ),
    ).toBe(true);
  });

  it("is a no-op when the id is unset", () => {
    analytics.initGtag("");
    expect(window.dataLayer).toBeUndefined();
    expect(
      scriptTags().some((src) =>
        src.startsWith("https://www.googletagmanager.com/gtag/js"),
      ),
    ).toBe(false);
  });

  it("is idempotent: the script and config are injected at most once", () => {
    analytics.initGtag(ID);
    analytics.initGtag(ID);
    const gtagScripts = scriptTags().filter((src) =>
      src.startsWith("https://www.googletagmanager.com/gtag/js"),
    );
    expect(gtagScripts).toHaveLength(1);
    expect(
      dataLayerArgs().filter((call) => call[0] === "config").length,
    ).toBe(1);
  });

  it("updates consent to granted or denied", () => {
    analytics.initGtag(ID);
    analytics.setConsent(true, ID);
    expect(lastCall()).toEqual([
      "consent",
      "update",
      {
        ad_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "granted",
      },
    ]);
    analytics.setConsent(false, ID);
    expect(lastCall()).toEqual([
      "consent",
      "update",
      {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      },
    ]);
  });

  it("does not update consent when the id is unset", () => {
    analytics.initGtag("");
    analytics.setConsent(true, "");
    expect(window.dataLayer).toBeUndefined();
  });

  it("tracks a page view on route changes", () => {
    analytics.initGtag(ID);
    analytics.trackPageView("/feed", ID);
    expect(lastCall()).toEqual([
      "config",
      ID,
      { page_path: "/feed" },
    ]);
  });

  it("fires the feed conversion without a value or currency", () => {
    analytics.initGtag(ID);
    analytics.setConsent(true, ID);
    analytics.trackConversion(ID);
    expect(lastCall()).toEqual([
      "event",
      "conversion",
      { send_to: "AW-18396502888/fiC1CP7z0eMcEOi2kcRE" },
    ]);
  });

  it("enqueues the conversion only after the consent update", () => {
    analytics.initGtag(ID);
    analytics.setConsent(true, ID);
    analytics.trackConversion(ID);
    const calls = dataLayerArgs();
    const conversionIdx = calls.findIndex(
      (call) => call[0] === "event" && call[1] === "conversion",
    );
    expect(conversionIdx).toBeGreaterThan(0);
    expect(calls[conversionIdx - 1]).toEqual([
      "consent",
      "update",
      {
        ad_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "granted",
      },
    ]);
  });

  it("does not fire the conversion before consent is granted", () => {
    analytics.initGtag(ID);
    analytics.trackConversion(ID);
    expect(
      dataLayerArgs().some(
        (call) => call[0] === "event" && call[1] === "conversion",
      ),
    ).toBe(false);
  });

  it("does not fire the conversion when the id is unset", () => {
    analytics.initGtag("");
    analytics.setConsent(true, "");
    analytics.trackConversion("");
    expect(window.dataLayer).toBeUndefined();
  });
});
