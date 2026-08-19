import { describe, expect, it } from "vitest";
import type { TFunction } from "i18next";

import { pageTitle } from "./page-title";

function fakeT(key: string): string {
  return key;
}

describe("pageTitle", () => {
  it("uses the address title on the landing and address pages", () => {
    const title = pageTitle("/address", fakeT as unknown as TFunction);
    expect(title).toBe("address.title — app.title");
  });

  it("uses the app tagline on the feed", () => {
    const title = pageTitle("/feed", fakeT as unknown as TFunction);
    expect(title).toBe("app.tagline — app.title");
  });

  it("uses the support title on the support page", () => {
    const title = pageTitle("/support", fakeT as unknown as TFunction);
    expect(title).toBe("support.title — app.title");
  });

  it("falls back to the tagline on any other route", () => {
    const title = pageTitle("/composer", fakeT as unknown as TFunction);
    expect(title).toBe("app.tagline — app.title");
  });
});