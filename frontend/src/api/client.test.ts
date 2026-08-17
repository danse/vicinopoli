import { afterEach, describe, expect, it, vi } from "vitest";

import { uploadPhotoToUrl } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("uploadPhotoToUrl", () => {
  it("reports the status, target, and content details on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 405,
        statusText: "Method Not Allowed",
        text: () => Promise.resolve("<html><body>nginx/1.31.3</body></html>"),
      }),
    );

    const err = await uploadPhotoToUrl(
      "https://media.example.test/objects/abc.jpg?X-Amz-Signature=secret",
      new Blob(["payload"], { type: "image/jpeg" }),
      "image/jpeg",
    ).then(
      () => null,
      (e: Error) => e,
    );

    expect(err).not.toBeNull();
    expect(err!.message).toContain("405");
    expect(err!.message).toContain("Method Not Allowed");
    expect(err!.message).toContain("media.example.test/objects/abc.jpg");
    expect(err!.message).toContain("image/jpeg");
  });

  it("includes the rejecting server's response body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 405,
        statusText: "Method Not Allowed",
        text: () => Promise.resolve("<html><body>nginx/1.31.3</body></html>"),
      }),
    );

    const err = await uploadPhotoToUrl(
      "https://media.example.test/objects/abc.jpg?X-Amz-Signature=secret",
      new Blob(["payload"]),
      "image/jpeg",
    ).then(
      () => null,
      (e: Error) => e,
    );

    expect(err!.message).toContain("nginx/1.31.3");
  });

  it("does not leak the presigned signature query parameters", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 405,
        statusText: "Method Not Allowed",
        text: () => Promise.resolve("<html><body>nginx/1.31.3</body></html>"),
      }),
    );

    const err = await uploadPhotoToUrl(
      "https://media.example.test/objects/abc.jpg?X-Amz-Signature=secret&X-Amz-Credential=key",
      new Blob(["payload"]),
      "image/jpeg",
    ).then(
      () => null,
      (e: Error) => e,
    );

    expect(err!.message).not.toContain("X-Amz-Signature");
    expect(err!.message).not.toContain("X-Amz-Credential");
  });
});
