import { afterEach, describe, expect, it, vi } from "vitest";

import { hashAddress, normalizeAddress } from "./utils";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("normalizeAddress", () => {
  it("collapses whitespace, trims, and lowercases", () => {
    expect(normalizeAddress("  Via   Roma 1 , Roma ")).toBe(
      "via roma 1 , roma",
    );
  });
});

describe("hashAddress", () => {
  it("returns a 64-char hex sha-256 of the normalized address", async () => {
    const hash = await hashAddress("Via Inesistente 99, Città");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("does not contain the original address text", async () => {
    const hash = await hashAddress("Via Inesistente 99, Città");
    expect(hash).not.toContain("via inesistente");
    expect(hash).not.toContain("Via Inesistente");
  });

  it("hashes same address consistently regardless of whitespace", async () => {
    const a = await hashAddress("Via Roma 1, Roma");
    const b = await hashAddress("  via   roma 1,  roma ");
    expect(a).toBe(b);
  });

  it("returns empty string when crypto is unavailable", async () => {
    const unset = vi
      .spyOn(globalThis, "crypto", "get")
      .mockReturnValue({} as Crypto);
    try {
      expect(await hashAddress("Via Roma 1, Roma")).toBe("");
    } finally {
      unset.mockRestore();
    }
  });
});
