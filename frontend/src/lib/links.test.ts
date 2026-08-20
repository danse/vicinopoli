import { describe, expect, it } from "vitest";

import { extractFirstUrl, splitFirstUrl } from "./links";

describe("splitFirstUrl", () => {
  it("returns null for text without a URL", () => {
    expect(splitFirstUrl("ciao vicini")).toBeNull();
  });

  it("splits text around the first URL", () => {
    const parts = splitFirstUrl("guarda https://example.com/a qui");
    expect(parts).toEqual({
      before: "guarda ",
      url: "https://example.com/a",
      after: " qui",
    });
  });

  it("handles a URL at the start and at the end", () => {
    expect(splitFirstUrl("https://example.com/a fine")).toMatchObject({
      before: "",
      url: "https://example.com/a",
      after: " fine",
    });
    expect(splitFirstUrl("inizio https://example.com/a")).toMatchObject({
      before: "inizio ",
      url: "https://example.com/a",
      after: "",
    });
  });

  it("trims trailing punctuation from the URL", () => {
    const parts = splitFirstUrl("vedi https://example.com/a. ciao");
    expect(parts?.url).toBe("https://example.com/a");
    expect(parts?.after).toBe(". ciao");
  });

  it("keeps query strings intact", () => {
    const parts = splitFirstUrl("https://example.com/?q=1&x=2");
    expect(parts?.url).toBe("https://example.com/?q=1&x=2");
  });

  it("keeps only the first URL when several are present", () => {
    const parts = splitFirstUrl("https://a.test/1 e https://b.test/2");
    expect(parts?.url).toBe("https://a.test/1");
    expect(parts?.after).toBe(" e https://b.test/2");
  });
});

describe("extractFirstUrl", () => {
  it("returns the first URL or null", () => {
    expect(extractFirstUrl("ciao https://example.com/a")).toBe(
      "https://example.com/a",
    );
    expect(extractFirstUrl("niente link")).toBeNull();
  });
});