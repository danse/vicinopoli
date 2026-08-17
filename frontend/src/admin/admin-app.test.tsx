import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "../i18n";

import { AdminApp } from "./admin-app";

const feed = {
  posts: [
    {
      id: "post-1",
      body: "Messaggio da controllare",
      voice: "city",
      status: "auto_hidden",
      display_address: "Via Roma 1, Roma",
      geohash: "sr1x",
      created_at: "2026-08-17T00:00:00Z",
      pseudonym: "Gina",
      new_neighbour: false,
      report_count: 3,
      device_id: "device-1",
      media: [],
    },
  ],
  next_cursor: null,
};

function mockFetch(opts: { status?: number } = {}) {
  return vi.fn().mockImplementation(() => {
    if (opts.status === 401) {
      return Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ detail: "unauthorized" }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(feed),
    });
  });
}

describe("AdminApp", () => {
  it("asks for the admin token before showing the firehose", () => {
    render(<AdminApp />);
    expect(screen.getByTestId("admin-token")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-post")).not.toBeInTheDocument();
  });

  it("shows an error for an empty token", () => {
    render(<AdminApp />);
    fireEvent.click(screen.getByTestId("admin-login"));
    expect(screen.getByTestId("admin-error")).toBeInTheDocument();
  });

  it("shows an error when the token is rejected", async () => {
    vi.stubGlobal("fetch", mockFetch({ status: 401 }));
    render(<AdminApp />);
    fireEvent.change(screen.getByTestId("admin-token"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByTestId("admin-login"));
    await waitFor(() => {
      expect(screen.getByTestId("admin-error")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("admin-post")).not.toBeInTheDocument();
  });

  it("renders posts with status, report count, address and geohash", async () => {
    vi.stubGlobal("fetch", mockFetch());
    render(<AdminApp />);
    fireEvent.change(screen.getByTestId("admin-token"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByTestId("admin-login"));

    await waitFor(() => {
      expect(screen.getByTestId("admin-post")).toBeInTheDocument();
    });
    expect(screen.getByTestId("admin-status")).toHaveTextContent("auto_hidden");
    expect(screen.getByTestId("admin-report-count")).toHaveTextContent("3");
    expect(screen.getByText("Messaggio da controllare")).toBeInTheDocument();
    expect(
      screen.getByText(/Via Roma 1, Roma/),
    ).toBeInTheDocument();
  });

  it("sends the token as X-Admin-Token on the firehose request", async () => {
    const store = mockFetch();
    vi.stubGlobal("fetch", store);
    render(<AdminApp />);
    fireEvent.change(screen.getByTestId("admin-token"), {
      target: { value: "secret-token" },
    });
    fireEvent.click(screen.getByTestId("admin-login"));

    await waitFor(() => {
      expect(screen.getByTestId("admin-post")).toBeInTheDocument();
    });
    const call = store.mock.calls.find(([path]: unknown[]) =>
      typeof path === "string" && path.startsWith("/api/admin/posts"),
    );
    expect(call).toBeDefined();
    const init = call![1] as RequestInit;
    expect(init.headers).toEqual(
      expect.objectContaining({ "X-Admin-Token": "secret-token" }),
    );
  });

  it("builds the zone link against the public address page", async () => {
    vi.stubGlobal("fetch", mockFetch());
    render(<AdminApp />);
    fireEvent.change(screen.getByTestId("admin-token"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByTestId("admin-login"));

    await waitFor(() => {
      expect(screen.getByTestId("admin-zone-link")).toBeInTheDocument();
    });
    const href = screen
      .getByTestId("admin-zone-link")
      .getAttribute("href");
    expect(href).toBe(
      `http://localhost:8080/address?address=${encodeURIComponent("Via Roma 1, Roma")}`,
    );
  });
});