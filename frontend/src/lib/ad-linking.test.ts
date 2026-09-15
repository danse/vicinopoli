import { afterEach, describe, expect, it, vi } from "vitest";

import {
  adParamsFromSearch,
  captureAdClickParams,
  restoreAdClickParams,
} from "./ad-linking";

const realLocation = window.location;
const realReplaceState = window.history.replaceState;

function stubLocation(search: string, href: string) {
  const location = {
    search,
    href,
    pathname: new URL(href).pathname,
    searchParams: new URLSearchParams(search),
  };
  Object.defineProperty(window, "location", {
    configurable: true,
    value: location,
  });
}

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: realLocation,
  });
  window.history.replaceState = realReplaceState;
});

describe("adParamsFromSearch", () => {
  it("keeps only the ad params, dropping everything else", () => {
    expect(adParamsFromSearch("?gclid=abc&gad_source=1&foo=bar")).toBe(
      "gclid=abc&gad_source=1",
    );
    expect(adParamsFromSearch("")).toBe("");
    expect(adParamsFromSearch("?foo=bar")).toBe("");
    expect(adParamsFromSearch("gclid=abc")).toBe("gclid=abc");
    expect(adParamsFromSearch("?wbraid=x&gad_campaignid=42")).toBe(
      "wbraid=x&gad_campaignid=42",
    );
  });
});

describe("capture + restore", () => {
  it("re-attaches the landing ad params to a URL that dropped them", () => {
    stubLocation("?gclid=abc&gad_source=1", "http://localhost:3000/");
    captureAdClickParams();

    // SPA navigation to the feed dropped the params.
    stubLocation("", "http://localhost:3000/feed");
    const replaceState = vi.spyOn(window.history, "replaceState");

    restoreAdClickParams();

    expect(replaceState).toHaveBeenCalledTimes(1);
    const url = replaceState.mock.calls[0][2] as string;
    expect(url).toContain("gclid=abc");
    expect(url).toContain("gad_source=1");
  });

  it("keeps existing params and adds the ad params", () => {
    stubLocation("?gclid=abc", "http://localhost:3000/");
    captureAdClickParams();

    stubLocation("?cursor=xyz", "http://localhost:3000/feed?cursor=xyz");
    const replaceState = vi.spyOn(window.history, "replaceState");

    restoreAdClickParams();

    const url = replaceState.mock.calls[0][2] as string;
    expect(url).toContain("cursor=xyz");
    expect(url).toContain("gclid=abc");
  });

  it("does not touch the URL when no ad params were captured", () => {
    stubLocation("", "http://localhost:3000/");
    captureAdClickParams();

    stubLocation("", "http://localhost:3000/feed");
    const replaceState = vi.spyOn(window.history, "replaceState");

    restoreAdClickParams();

    expect(replaceState).not.toHaveBeenCalled();
  });
});