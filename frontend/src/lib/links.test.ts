import { describe, expect, it } from "vitest";

import { extractFirstUrl, linkify, splitFirstUrl } from "./links";

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

describe("linkify", () => {
  it("keeps text without URLs as a single plain segment", () => {
    expect(linkify("ciao vicini")).toEqual([{ text: "ciao vicini" }]);
  });

  it("turns a single URL into a link segment", () => {
    expect(linkify("guarda https://example.com/a qui")).toEqual([
      { text: "guarda " },
      { text: "https://example.com/a", url: "https://example.com/a" },
      { text: " qui" },
    ]);
  });

  it("turns every URL in the message into a link segment", () => {
    expect(linkify("https://a.test/1 e https://b.test/2 fine")).toEqual([
      { text: "https://a.test/1", url: "https://a.test/1" },
      { text: " e " },
      { text: "https://b.test/2", url: "https://b.test/2" },
      { text: " fine" },
    ]);
  });

  it("trims trailing punctuation from each URL, keeping it as text", () => {
    expect(linkify("vedi https://example.com/a. e https://example.com/b!")).toEqual(
      [
        { text: "vedi " },
        { text: "https://example.com/a", url: "https://example.com/a" },
        { text: ". e " },
        { text: "https://example.com/b", url: "https://example.com/b" },
        { text: "!" },
      ],
    );
  });

  it("keeps query strings intact", () => {
    expect(linkify("https://example.com/?q=1&x=2")).toEqual([
      { text: "https://example.com/?q=1&x=2", url: "https://example.com/?q=1&x=2" },
    ]);
  });

  it("turns a bare domain into a link with an https scheme", () => {
    expect(linkify("ascolta radiofrance.fr")).toEqual([
      { text: "ascolta " },
      { text: "radiofrance.fr", url: "https://radiofrance.fr" },
    ]);
  });

  it("turns a bare domain with a path into a link", () => {
    expect(linkify("radiofrance.fr/musique")).toEqual([
      {
        text: "radiofrance.fr/musique",
        url: "https://radiofrance.fr/musique",
      },
    ]);
  });

  it("mixes bare domains and full URLs in one message", () => {
    expect(linkify("guarda https://example.com/a e radiofrance.fr")).toEqual([
      { text: "guarda " },
      { text: "https://example.com/a", url: "https://example.com/a" },
      { text: " e " },
      { text: "radiofrance.fr", url: "https://radiofrance.fr" },
    ]);
  });

  it("does not mistake sentence punctuation for a domain", () => {
    expect(linkify("al bar. Fai presto")).toEqual([
      { text: "al bar. Fai presto" },
    ]);
  });

  it("ignores dot-separated numbers and IP addresses", () => {
    expect(linkify("versione 1.2.3 o 127.0.0.1")).toEqual([
      { text: "versione 1.2.3 o 127.0.0.1" },
    ]);
  });
});