import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import "./i18n";

const created = {
  id: "post-1",
  body: "Ciao vicini!",
  scope: "1km",
  location: {
    id: "loc-1",
    display_address: "Via Roma 1, Roma",
    geohash: "sr1x",
  },
  distance_m: 0.0,
  created_at: "2026-08-13T00:00:00Z",
};

const feed = {
  posts: [
    {
      id: "post-1",
      body: "Ciao vicini!",
      scope: "1km",
      display_address: "Via Roma 1, Roma",
      geohash: "sr1x",
      distance_m: 0.0,
      created_at: "2026-08-13T00:00:00Z",
      pseudonym: "Gino",
      new_neighbour: true,
    },
  ],
  effective_radius_m: 500,
  target_count: 10,
};

const device = {
  id: "device-1",
  pseudonym: null,
  new_neighbour: true,
  created_at: "2026-08-13T00:00:00Z",
};
function mockFetch() {
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    let body: Record<string, unknown>;
    if (url === "/api/me") {
      body =
        method === "PATCH" ? { ...device, pseudonym: "Gino" } : { ...device };
    } else if (url.startsWith("/api/feed")) {
      body = { ...feed };
    } else {
      body = { ...created };
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(body),
    });
  });
}
describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch());
  });

  it("renders the app title", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "vicinopoli" }),
    ).toBeInTheDocument();
  });

  it("shows the composer with address and message inputs", () => {
    render(<App />);
    expect(screen.getByLabelText("Il tuo indirizzo")).toBeInTheDocument();
    expect(screen.getByLabelText("Scegli un nome")).toBeInTheDocument();
    expect(screen.getByLabelText("Scrivi un messaggio")).toBeInTheDocument();
  });

  it("posts a message and renders it in the feed", async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("Il tuo indirizzo"), {
      target: { value: "Via Roma 1, Roma" },
    });
    fireEvent.change(screen.getByLabelText("Scrivi un messaggio"), {
      target: { value: "Ciao vicini!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pubblica" }));

    await waitFor(() => {
      expect(screen.getByText("Ciao vicini!")).toBeInTheDocument();
    });
    expect(screen.getByText("Gino")).toBeInTheDocument();
  });
});
