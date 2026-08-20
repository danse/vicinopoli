import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import {
  DEBOUNCE_MS,
  clearSuggestionCache,
} from "./components/address-combobox";
import "./i18n";

const sentryCapture = vi.fn();
vi.mock("@sentry/react", () => ({
  captureException: (err: unknown, hint?: unknown) => sentryCapture(err, hint),
}));

const analytics = vi.hoisted(() => ({
  initGtag: vi.fn(),
  setConsent: vi.fn(),
  trackPageView: vi.fn(),
  trackConversion: vi.fn(),
}));
vi.mock("@/lib/analytics", () => analytics);

vi.mock("maplibre-gl", () => ({
  Map: vi.fn().mockImplementation(() => {
    const handlers: Record<string, () => void> = {};
    const map = {
      on: (event: string, cb: () => void) => {
        handlers[event] = cb;
        return map;
      },
      fire: (event: string) => handlers[event]?.(),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      getSource: vi.fn().mockReturnValue({
        setData: vi.fn(),
      }),
    };
    return map;
  }),
  GeoJSONSource: class {},
}));

beforeAll(() => {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 100, height: 100 }),
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
    canvas: {},
  } as unknown as CanvasRenderingContext2D);
  Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
    configurable: true,
    value: (cb: (b: Blob | null) => void) => cb(new Blob()),
  });
});

const created = {
  id: "post-1",
  body: "Ciao vicini!",
  voice: "city",
  location: {
    id: "loc-1",
    display_address: "Via Roma 1, Roma",
    geohash: "sr1x",
  },
  distance_m: 0.0,
  created_at: "2026-08-13T00:00:00Z",
  daily_post_limit: 3,
  posts_left_today: 2,
};

const feed = {
  posts: [
    {
      id: "post-1",
      body: "Ciao vicini!",
      voice: "city",
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

const presign = {
  object_key: "images/2026/08/abc.jpg",
  url: "https://storage.example.test/abc.jpg",
  kind: "image",
  content_type: "image/jpeg",
  size: 1024,
};

const registered = {
  id: "media-1",
  kind: "image",
  object_key: "images/2026/08/abc.jpg",
  content_type: "image/jpeg",
  size: 1024,
};

const feedWithMedia = {
  posts: [
    {
      ...feed.posts[0],
      media: [
        {
          id: "media-1",
          kind: "image",
          url: "https://x.test/abc.jpg",
          duration_s: null,
        },
      ],
    },
  ],
  effective_radius_m: 500,
  target_count: 10,
};

const device = {
  id: "device-1",
  pseudonym: null,
  new_neighbour: true,
  daily_post_limit: 3,
  posts_left_today: 3,
  created_at: "2026-08-13T00:00:00Z",
  experiment_segment: 7,
  experiment_flags: {},
  analytics_consent: null,
};
function mockFetch() {
  let consented: boolean | null = null;
  let pseudonym: string | null = null;
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    let body: Record<string, unknown>;
    if (url === "/api/me") {
      body = { ...device, analytics_consent: consented, pseudonym };
    } else if (url === "/api/geocode") {
      body = {
        display_address: "Via Roma 1, Roma",
        cell: "sr1m9h",
        cell_center_latitude: 41.89,
        cell_center_longitude: 12.48,
      };
    } else if (url.startsWith("/api/geocode/reverse")) {
      body = { display_address: "Piazza Venezia, Roma" };
    } else if (url.startsWith("/api/geocode/suggest")) {
      const q = new URL(url, "http://localhost").searchParams.get("q") ?? "";
      const all = [
        "Via Roma 1, Roma",
        "Piazza Venezia, Roma",
        "Milano Centrale, Milano",
      ];
      body = {
        suggestions: all.filter((s) =>
          s.toLowerCase().includes(q.toLowerCase()),
        ),
      };
    } else if (url.startsWith("/api/heatmap")) {
      body = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { cell: "sr1m9h", count: 2 },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [12.48, 41.89],
                  [12.5, 41.89],
                  [12.5, 41.9],
                  [12.48, 41.9],
                  [12.48, 41.89],
                ],
              ],
            },
          },
        ],
      };
    } else if (url.startsWith("/api/feed")) {
      body = { ...feedWithMedia };
    } else if (url === "/api/media/presign") {
      body = presign;
    } else if (url === "/api/media/register") {
      body = registered;
    } else if (url === "/api/events") {
      body = { accepted: 1, stored: 1 };
    } else if (/^https:\/\/storage/.test(url)) {
      body = {};
    } else {
      body = { ...created, media: [registered] };
    }
    if (method === "PATCH" && url === "/api/me") {
      const payload = JSON.parse(String(init?.body ?? "{}")) as {
        analytics_consent?: boolean | null;
        pseudonym?: string;
      };
      consented = payload.analytics_consent ?? null;
      if (payload.pseudonym !== undefined) {
        pseudonym = payload.pseudonym || null;
      }
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(body),
    });
  });
}

function renderApp(initialEntry = "/") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <App />
    </MemoryRouter>,
  );
}

async function submitAddress(value = "Via Roma 1, Roma") {
  fireEvent.change(screen.getByTestId("address-input"), {
    target: { value },
  });
  fireEvent.click(screen.getByTestId("address-submit"));
  await waitFor(() => {
    expect(screen.getByTestId("feed-compose")).toBeInTheDocument();
  });
}

async function openComposer() {
  await submitAddress();
  fireEvent.click(screen.getByTestId("feed-compose"));
  await waitFor(() => {
    expect(screen.getByTestId("composer-message")).toBeInTheDocument();
  });
}

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch());
    clearSuggestionCache();
    analytics.initGtag.mockClear();
    analytics.setConsent.mockClear();
    analytics.trackPageView.mockClear();
    analytics.trackConversion.mockClear();
    document.title = "";
  });

  it("renders the app title", () => {
    renderApp();
    expect(
      screen.getByRole("heading", { name: "vicinopoli" }),
    ).toBeInTheDocument();
  });

  it("shows a build version footer with a short commit hash", () => {
    renderApp();
    const footer = screen.getByTestId("app-footer");
    expect(footer).toBeInTheDocument();
    const version = screen.getByTestId("app-footer-version");
    expect(version.textContent).toMatch(/^(dev|[0-9a-f]{7,})$/);
  });

  it("shows the consent banner and sends onboarding events when accepted", async () => {
    renderApp();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Accetta" }),
      ).toBeInTheDocument();
    });
    expect(analytics.setConsent).not.toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "Accetta" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Accetta" }),
      ).not.toBeInTheDocument();
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/events",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("onboarding_completed"),
      }),
    );
    expect(analytics.initGtag).toHaveBeenCalledTimes(1);
    expect(analytics.setConsent).toHaveBeenLastCalledWith(true);
  });

  it("fires the feed conversion only after consent and on the feed page", async () => {
    renderApp("/");
    await waitFor(() => {
      expect(screen.getByTestId("address-input")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Accetta" }));
    await waitFor(() => {
      expect(analytics.setConsent).toHaveBeenLastCalledWith(true);
    });
    expect(analytics.trackConversion).not.toHaveBeenCalled();

    submitAddress();
    await waitFor(() => {
      expect(screen.getByTestId("feed-compose")).toBeInTheDocument();
    });
    expect(analytics.trackConversion).toHaveBeenCalledTimes(1);
  });

  it("never fires the feed conversion when consent is declined", async () => {
    renderApp("/");
    await waitFor(() => {
      expect(screen.getByTestId("address-input")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Rifiuta" }));
    await waitFor(() => {
      expect(analytics.setConsent).toHaveBeenLastCalledWith(false);
    });

    submitAddress();
    await waitFor(() => {
      expect(screen.getByTestId("feed-compose")).toBeInTheDocument();
    });
    expect(analytics.trackConversion).not.toHaveBeenCalled();
  });

  it("reports viewed posts to analytics with post ids", async () => {
    renderApp("/");
    await waitFor(() => {
      expect(screen.getByTestId("address-input")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Accetta" }));
    await waitFor(() => {
      expect(analytics.setConsent).toHaveBeenLastCalledWith(true);
    });

    submitAddress();
    await waitFor(() => {
      expect(screen.getByTestId("feed-compose")).toBeInTheDocument();
    });

    const calls = vi.mocked(fetch).mock.calls.filter(
      (call): call is [RequestInfo | URL, RequestInit] =>
        call[0] === "/api/events" && String(call[1]?.body).includes("post_viewed"),
    );
    expect(calls).toHaveLength(1);
    const payload = JSON.parse(String(calls[0][1].body)) as {
      events: {
        name: string;
        post_id: string;
        geohash: string;
        occurred_at?: string;
      }[];
    };
    expect(payload.events[0]).toMatchObject({
      name: "post_viewed",
      post_id: "post-1",
      geohash: "sr1x",
    });
    expect(payload.events[0].occurred_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("publishing sends a post_created analytics event when consented", async () => {
    renderApp("/");
    await waitFor(() => {
      expect(screen.getByTestId("address-input")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Accetta" }));
    await waitFor(() => {
      expect(analytics.setConsent).toHaveBeenLastCalledWith(true);
    });

    await openComposer();
    fireEvent.change(screen.getByTestId("composer-message"), {
      target: { value: "ciao" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pubblica" }));
    await waitFor(() => {
      expect(screen.getByTestId("feed-compose")).toBeInTheDocument();
    });

    const calls = vi.mocked(fetch).mock.calls.filter(
      (call): call is [RequestInfo | URL, RequestInit] =>
        call[0] === "/api/events" && String(call[1]?.body).includes("post_created"),
    );
    expect(calls).toHaveLength(1);
    const payload = JSON.parse(String(calls[0][1].body)) as {
      events: {
        name: string;
        post_id: string;
        geohash: string;
        occurred_at?: string;
      }[];
    };
    expect(payload.events[0]).toMatchObject({
      name: "post_created",
      post_id: "post-1",
      geohash: "sr1x",
    });
    expect(payload.events[0].occurred_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("does not send post_created analytics without consent", async () => {
    renderApp("/");
    await waitFor(() => {
      expect(screen.getByTestId("address-input")).toBeInTheDocument();
    });

    await openComposer();
    fireEvent.change(screen.getByTestId("composer-message"), {
      target: { value: "ciao" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pubblica" }));
    await waitFor(() => {
      expect(screen.getByTestId("feed-compose")).toBeInTheDocument();
    });

    const calls = vi.mocked(fetch).mock.calls.filter(
      ([url, init]) =>
        url === "/api/events" && String(init?.body).includes("post_created"),
    );
    expect(calls).toHaveLength(0);
  });

  it("keeps Google consent denied when the banner is declined", async () => {
    renderApp();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Rifiuta" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Rifiuta" }));

    await waitFor(() => {
      expect(analytics.setConsent).toHaveBeenLastCalledWith(false);
    });
    expect(
      screen.queryByRole("button", { name: "Rifiuta" }),
    ).not.toBeInTheDocument();
  });

  it("redirects the root to the address page", async () => {
    renderApp("/");
    await waitFor(() => {
      expect(screen.getByTestId("address-input")).toBeInTheDocument();
    });
    expect(document.title).toBe("Dove ti trovi? — vicinopoli");
  });

  it("keeps the submit disabled until an address is entered", async () => {
    renderApp();
    await waitFor(() => {
      expect(screen.getByTestId("address-input")).toBeInTheDocument();
    });
    expect(screen.getByTestId("address-submit")).toBeDisabled();
    fireEvent.change(screen.getByTestId("address-input"), {
      target: { value: "Via Roma 1, Roma" },
    });
    expect(screen.getByTestId("address-submit")).toBeEnabled();
  });

  it("pre-fills the address input from the browser location", async () => {
    vi.stubGlobal(
      "navigator",
      Object.defineProperty(
        {},
        "geolocation",
        {
          configurable: true,
          value: {
            getCurrentPosition: vi.fn().mockImplementation((success) =>
              success({ coords: { latitude: 41.8957, longitude: 12.4823 } }),
            ),
          },
        },
      ),
    );

    renderApp();
    await waitFor(() => {
      expect(screen.getByTestId("address-input")).toHaveValue(
        "Piazza Venezia, Roma",
      );
    });
  });

  it("leaves the address empty when geolocation is denied", async () => {
    vi.stubGlobal(
      "navigator",
      Object.defineProperty({}, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition: vi.fn().mockImplementation((_success, error) =>
            error?.(new Error("denied")),
          ),
        },
      }),
    );

    renderApp();
    await waitFor(() => {
      expect(screen.getByTestId("address-input")).toBeInTheDocument();
    });
    expect(screen.getByTestId("address-input")).toHaveValue("");
  });

  it("leaves the address empty when the reverse geocode finds nothing", async () => {
    vi.stubGlobal(
      "navigator",
      Object.defineProperty({}, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition: vi.fn().mockImplementation((success) =>
            success({ coords: { latitude: 0, longitude: 0 } }),
          ),
        },
      }),
    );
    const store = mockFetch();
    store.mockImplementation((url: string, init?: RequestInit) => {
      if (url.startsWith("/api/geocode/reverse")) {
        return Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ detail: "address not found" }),
        });
      }
      return mockFetch()(url, init);
    });
    vi.stubGlobal("fetch", store);

    renderApp();
    await waitFor(() => {
      expect(screen.getByTestId("address-input")).toBeInTheDocument();
    });
    expect(screen.getByTestId("address-input")).toHaveValue("");
  });

  it("does not overwrite a typed address with a located one", async () => {
    vi.stubGlobal(
      "navigator",
      Object.defineProperty({}, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition: vi.fn().mockImplementation((success) =>
            success({ coords: { latitude: 41.8957, longitude: 12.4823 } }),
          ),
        },
      }),
    );

    renderApp();
    await waitFor(() => {
      expect(screen.getByTestId("address-input")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByTestId("address-input"), {
      target: { value: "Milano Centrale, Milano" },
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByTestId("address-input")).toHaveValue(
      "Milano Centrale, Milano",
    );
  });

  it("submitting an address shows the feed page", async () => {
    renderApp();
    await submitAddress();
    expect(screen.getByTestId("feed-compose")).toBeInTheDocument();
    expect(document.title).toBe("La piazza delle tue vicine — vicinopoli");
  });

  it("hides the heatmap when its feature flag is off", async () => {
    renderApp();
    await submitAddress();
    await waitFor(() => {
      expect(screen.getByTestId("feed-compose")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("heatmap")).not.toBeInTheDocument();
  });

  it("shows the heatmap when its feature flag is on", async () => {
    const store = mockFetch();
    store.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/me") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ ...device, experiment_flags: { heatmap: true } }),
        });
      }
      return mockFetch()(url, init);
    });
    vi.stubGlobal("fetch", store);

    renderApp();
    await submitAddress();
    await waitFor(() => {
      expect(screen.getByTestId("heatmap")).toBeInTheDocument();
    });
  });

  it("persists the address so a refresh restores it", async () => {
    renderApp();
    await submitAddress("Via Roma 1, Roma");
    expect(localStorage.getItem("vicinopoli.address")).toBe("Via Roma 1, Roma");
  });

  it("restores a persisted address and skips the address page", async () => {
    localStorage.setItem("vicinopoli.address", "Via Roma 1, Roma");
    const { unmount } = render(
      <MemoryRouter initialEntries={["/feed"]}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("feed-compose")).toBeInTheDocument();
    });
    unmount();
    expect(localStorage.getItem("vicinopoli.address")).toBe("Via Roma 1, Roma");
  });

  it("redirects the root to the feed when an address is already set", async () => {
    localStorage.setItem("vicinopoli.address", "Via Roma 1, Roma");
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("feed-compose")).toBeInTheDocument();
    });
  });

  it("redirects the feed and composer pages to the address page when no address is set", async () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={["/feed"]}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("address-input")).toBeInTheDocument();
    });
    rerender(
      <MemoryRouter initialEntries={["/composer"]}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("address-input")).toBeInTheDocument();
    });
  });

  it("the feed plus button leads to the composer page", async () => {
    renderApp();
    await openComposer();
    expect(screen.getByTestId("composer-message")).toBeInTheDocument();
  });

  it("shows only the inputs for the selected message type", async () => {
    renderApp();
    await openComposer();

    expect(screen.getByTestId("composer-message")).toBeInTheDocument();
    expect(screen.queryByTestId("composer-caption")).not.toBeInTheDocument();
    expect(screen.queryByTestId("composer-photo")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("composer-voice-start"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("composer-type-photo"));
    expect(screen.getByTestId("composer-photo")).toBeInTheDocument();
    expect(screen.getByTestId("composer-caption")).toBeInTheDocument();
    expect(screen.queryByTestId("composer-message")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("composer-voice-start"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("composer-type-voice"));
    expect(screen.getByTestId("composer-voice-start")).toBeInTheDocument();
    expect(screen.getByTestId("composer-caption")).toBeInTheDocument();
    expect(screen.queryByTestId("composer-photo")).not.toBeInTheDocument();
  });

  it("shows the composer's daily quota hint", async () => {
    renderApp();
    await openComposer();
    expect(screen.getByText("Ti restano 3 post oggi")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("composer-quota-help"));
    await waitFor(() => {
      expect(screen.getByTestId("quota-help-dialog")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("quota-help-close"));
    await waitFor(() => {
      expect(screen.queryByTestId("quota-help-dialog")).not.toBeVisible();
    });
  });

  it("the composer shows the current pseudonym with a link to change it", async () => {
    renderApp();
    await openComposer();
    expect(screen.getByText("Pubblicando come")).toBeInTheDocument();
    expect(screen.getByText("Vicina anonima")).toBeInTheDocument();
    const change = screen.getByTestId("composer-change-pseudonym");
    fireEvent.click(change);
    await waitFor(() => {
      expect(screen.getByTestId("pseudonym-input")).toBeInTheDocument();
    });
  });

  it("saving a pseudonym on its own page sends it and navigates back", async () => {
    const store = mockFetch();
    vi.stubGlobal("fetch", store);
    renderApp();
    await openComposer();
    fireEvent.click(screen.getByTestId("composer-change-pseudonym"));
    await waitFor(() => {
      expect(screen.getByTestId("pseudonym-input")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByTestId("pseudonym-input"), {
      target: { value: "Gina" },
    });
    fireEvent.click(screen.getByTestId("pseudonym-submit"));
    await waitFor(() => {
      expect(screen.getByTestId("composer-message")).toBeInTheDocument();
    });
    const mePatch = store.mock.calls.find(
      ([path, init]: unknown[]) =>
        path === "/api/me" && (init as RequestInit)?.method === "PATCH",
    );
    expect(mePatch).toBeDefined();
    const init = mePatch![1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({
      pseudonym: "Gina",
    });
  });

  it("the feed shows the address with a change link back to the address page", async () => {
    renderApp();
    await submitAddress();
    const change = screen.getByTestId("feed-change-address");
    expect(change).toBeInTheDocument();
    expect(change.closest("div")?.textContent).toContain("Via Roma 1, Roma");
    fireEvent.click(change);
    await waitFor(() => {
      expect(screen.getByTestId("address-input")).toBeInTheDocument();
    });
  });

  it("posts a message and renders it in the feed", async () => {
    renderApp();

    await openComposer();
    fireEvent.change(screen.getByTestId("composer-message"), {
      target: { value: "Ciao vicini!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pubblica" }));

    await waitFor(() => {
      expect(screen.getByTestId("feed-compose")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("Ciao vicini!")).toBeInTheDocument();
    });
    expect(screen.getByText("Gino")).toBeInTheDocument();
  });

  it("shows the distance from the viewer on each feed post", async () => {
    const store = mockFetch();
    store.mockImplementation((url: string, init?: RequestInit) => {
      if (url.startsWith("/api/feed")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              posts: [
                { ...feed.posts[0], distance_m: 0.0 },
                {
                  ...feed.posts[0],
                  id: "post-2",
                  body: "Dal quartiere",
                  distance_m: 1200,
                },
              ],
              effective_radius_m: 5000,
              target_count: 10,
            }),
        });
      }
      return mockFetch()(url, init);
    });
    vi.stubGlobal("fetch", store);

    renderApp();
    await submitAddress();

    await waitFor(() => {
      const distances = screen.getAllByTestId("feed-post-distance");
      expect(distances).toHaveLength(2);
      expect(distances[0].textContent).toContain("0 m da te");
      expect(distances[1].textContent).toContain("1.2 km da te");
    });
  });

  it("publishing navigates back to the feed page", async () => {
    renderApp();
    await openComposer();
    fireEvent.change(screen.getByTestId("composer-message"), {
      target: { value: "ciao" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pubblica" }));
    await waitFor(() => {
      expect(screen.getByTestId("feed-compose")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("composer-message")).not.toBeInTheDocument();
  });

  it("the publish button stays enabled once a message is typed", async () => {
    renderApp();
    await openComposer();
    const publish = () =>
      screen.getByRole("button", { name: "Pubblica" }) as HTMLButtonElement;
    expect(publish().disabled).toBe(true);
    fireEvent.change(screen.getByTestId("composer-message"), {
      target: { value: "ciao" },
    });
    expect(publish().disabled).toBe(false);
  });

  it("a photo can be published without any text", async () => {
    renderApp();
    await openComposer();
    fireEvent.click(screen.getByTestId("composer-type-photo"));
    const publish = () =>
      screen.getByRole("button", { name: "Pubblica" }) as HTMLButtonElement;
    expect(publish().disabled).toBe(true);
    const file = new File(["x"], "photo.png", { type: "image/png" });
    fireEvent.change(screen.getByTestId("composer-photo"), {
      target: { files: [file] },
    });
    expect(publish().disabled).toBe(false);
    fireEvent.click(publish());
    await waitFor(() => {
      expect(screen.getByTestId("feed-compose")).toBeInTheDocument();
    });
  });

  it("reports a failed publish to Sentry with error details", async () => {
    sentryCapture.mockClear();
    const store = mockFetch();
    store.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/posts") {
        return Promise.reject(new Error("boom: upstream geocoder timed out"));
      }
      return mockFetch()(url, init);
    });
    vi.stubGlobal("fetch", store);

    renderApp();

    await openComposer();
    fireEvent.change(screen.getByTestId("composer-message"), {
      target: { value: "Ciao vicini!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pubblica" }));

    await waitFor(() => {
      expect(
        screen.getByText("Non è stato possibile pubblicare. Riprova."),
      ).toBeInTheDocument();
    });
    expect(sentryCapture).toHaveBeenCalledTimes(1);
    const reported = sentryCapture.mock.calls[0][0] as Error;
    expect(reported.message).toContain("boom");
  });

  it("reports an address-not-found failure with a hashed address, not the raw string", async () => {
    sentryCapture.mockClear();
    const store = mockFetch();
    store.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/posts") {
        return Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ detail: "address not found" }),
        });
      }
      return mockFetch()(url, init);
    });
    vi.stubGlobal("fetch", store);

    renderApp();

    await openComposer();
    fireEvent.change(screen.getByTestId("composer-message"), {
      target: { value: "ciao" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pubblica" }));

    await waitFor(() => {
      expect(screen.getByText("Indirizzo non trovato.")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(sentryCapture).toHaveBeenCalledTimes(1);
    });
    const [, hint] = sentryCapture.mock.calls[0];
    const extra = hint?.extra as Record<string, string>;
    expect(extra.addressHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(sentryCapture.mock.calls)).not.toContain(
      "Via Inesistente",
    );
  });

  it("sends the selected voice with the post", async () => {
    const store = mockFetch();
    vi.stubGlobal("fetch", store);

    renderApp();

    await openComposer();
    fireEvent.change(screen.getByTestId("composer-message"), {
      target: { value: "Messaggio per la mia via" },
    });
    fireEvent.click(screen.getByTestId("composer-voice-street"));
    fireEvent.click(screen.getByRole("button", { name: "Pubblica" }));

    await waitFor(() => {
      expect(screen.getByText("Ciao vicini!")).toBeInTheDocument();
    });
    const postCall = store.mock.calls.find(
      ([path]: unknown[]) => path === "/api/posts",
    );
    expect(postCall).toBeDefined();
    const init = postCall![1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({ voice: "street" });
  });

  it("uploads a photo and shows it in the feed", async () => {
    const store = mockFetch();
    vi.stubGlobal("fetch", store);

    renderApp();

    await openComposer();
    fireEvent.click(screen.getByTestId("composer-type-photo"));
    fireEvent.change(screen.getByTestId("composer-caption"), {
      target: { value: "Foto del quartiere" },
    });

    const file = new File(["x"], "photo.png", { type: "image/png" });
    fireEvent.change(screen.getByTestId("composer-photo"), {
      target: { files: [file] },
    });

    fireEvent.click(screen.getByRole("button", { name: "Pubblica" }));

    await waitFor(() => {
      expect(
        screen.getByRole("img", { name: "Foto allegata" }),
      ).toBeInTheDocument();
    });

    // The image takes all the horizontal space within the message.
    const img = screen.getByRole("img", { name: "Foto allegata" });
    expect(img).toHaveClass("w-full");
  });

  it("shows address suggestions while typing and fills the input on select", async () => {
    renderApp();

    const input = screen.getByTestId("address-input");
    fireEvent.change(input, { target: { value: "milano" } });

    await waitFor(
      () => {
        expect(
          screen.getByRole("option", { name: "Milano Centrale, Milano" }),
        ).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    fireEvent.mouseDown(
      screen.getByRole("option", { name: "Milano Centrale, Milano" }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("address-input")).toHaveValue(
        "Milano Centrale, Milano",
      );
    });
    expect(
      screen.queryByRole("option", { name: "Milano Centrale, Milano" }),
    ).not.toBeInTheDocument();
  });

  it("shows no suggestions for an unknown prefix", async () => {
    renderApp();

    fireEvent.change(screen.getByTestId("address-input"), {
      target: { value: "via inesistente" },
    });

    await waitFor(
      () => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("debounces rapid typing to a single suggest request", async () => {
    const store = mockFetch();
    vi.stubGlobal("fetch", store);
    renderApp();

    const input = screen.getByTestId("address-input");
    fireEvent.change(input, { target: { value: "mil" } });
    fireEvent.change(input, { target: { value: "mila" } });
    fireEvent.change(input, { target: { value: "milan" } });
    fireEvent.change(input, { target: { value: "milano" } });

    // Nothing fires before the debounce elapses.
    const suggestCallsBefore = store.mock.calls.filter(
      ([path]: unknown[]) =>
        typeof path === "string" && path.startsWith("/api/geocode/suggest"),
    );
    expect(suggestCallsBefore).toHaveLength(0);

    await waitFor(
      () => {
        expect(
          screen.getByRole("option", { name: "Milano Centrale, Milano" }),
        ).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const suggestCalls = store.mock.calls.filter(
      ([path]: unknown[]) =>
        typeof path === "string" && path.startsWith("/api/geocode/suggest"),
    );
    expect(suggestCalls).toHaveLength(1);
    expect(String(suggestCalls[0][0])).toContain("milano");
  });

  it("waits after typing stops before asking the geocoder", () => {
    // The plan: a suggest request should fire only once the full address has
    // been entered (debounced), so the production Nominatim rate limit is not
    // hit while typing.
    expect(DEBOUNCE_MS).toBe(400);
  });

  it("caches suggestions so re-searching a prefix does not refetch", async () => {
    const store = mockFetch();
    vi.stubGlobal("fetch", store);
    renderApp();

    const input = screen.getByTestId("address-input");
    fireEvent.change(input, { target: { value: "milano" } });
    await waitFor(
      () => {
        expect(
          screen.getByRole("option", { name: "Milano Centrale, Milano" }),
        ).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    // Clear below the min length: no suggest request fires.
    fireEvent.change(input, { target: { value: "mi" } });
    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    // Re-typing the same query must reuse the cache.
    fireEvent.change(input, { target: { value: "milano" } });
    await waitFor(
      () => {
        expect(
          screen.getByRole("option", { name: "Milano Centrale, Milano" }),
        ).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    const suggestCalls = store.mock.calls.filter(
      ([path]: unknown[]) =>
        typeof path === "string" && path.startsWith("/api/geocode/suggest"),
    );
    expect(suggestCalls).toHaveLength(1);
  });

  it("uploads a voice message and shows it in the feed", async () => {
    const voicePresign = {
      object_key: "voices/2026/08/abc.webm",
      url: "https://storage.example.test/abc.webm",
      kind: "voice",
      content_type: "audio/webm",
      size: 4096,
    };
    const voiceRegistered = {
      id: "media-2",
      kind: "voice",
      object_key: "voices/2026/08/abc.webm",
      content_type: "audio/webm",
      size: 4096,
    };
    const store = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        let body: Record<string, unknown>;
        if (url === "/api/me") {
          body =
            method === "PATCH"
              ? { ...device, pseudonym: "Gino" }
              : { ...device };
        } else if (url.startsWith("/api/feed")) {
          body = {
            ...feedWithMedia,
            posts: [
              {
                ...feed.posts[0],
                media: [
                  {
                    id: "media-2",
                    kind: "voice",
                    url: "https://x.test/abc.webm",
                    duration_s: 3.5,
                  },
                ],
              },
            ],
          };
        } else if (url === "/api/media/presign") {
          body = voicePresign;
        } else if (url.startsWith("/api/media/register")) {
          body = voiceRegistered;
        } else if (url === "https://storage.example.test/abc.webm") {
          body = {};
        } else {
          body = { ...created, media: [voiceRegistered] };
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(body),
        });
      });
    vi.stubGlobal("fetch", store);

    const FakeMediaRecorder = vi.fn().mockImplementation(() => {
      const instance = {
        state: "inactive",
        ondataavailable: null as ((e: { data: Blob }) => void) | null,
        onstop: null as (() => void) | null,
        start: () => {
          instance.state = "recording";
        },
        stop: () => {
          instance.state = "inactive";
          instance.ondataavailable?.({ data: new Blob(["voice"]) });
          instance.onstop?.();
        },
      };
      return instance;
    });
    (
      FakeMediaRecorder as unknown as {
        isTypeSupported: (t: string) => boolean;
      }
    ).isTypeSupported = vi.fn().mockReturnValue(true);
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    Object.defineProperty(window.navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
    });

    renderApp();

    await openComposer();
    fireEvent.click(screen.getByTestId("composer-type-voice"));
    fireEvent.change(screen.getByTestId("composer-caption"), {
      target: { value: "Messaggio vocale" },
    });

    fireEvent.click(screen.getByTestId("composer-voice-start"));
    await waitFor(() => {
      expect(screen.getByTestId("composer-voice-stop")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("composer-voice-stop"));
    const publishButton = () =>
      screen.getByRole("button", { name: "Pubblica" }) as HTMLButtonElement;
    await waitFor(() => {
      expect(publishButton().disabled).toBe(false);
    });
    fireEvent.click(publishButton());

    await waitFor(() => {
      expect(
        screen.getByLabelText("Messaggio vocale allegato"),
      ).toBeInTheDocument();
    });
  });

  it("loads the next page when the feed sentinel is scrolled into view", async () => {
    const store = mockFetch();
    const secondPage = {
      posts: [
        {
          id: "post-2",
          body: "Un post più vecchio",
          voice: "city",
          display_address: "Via Roma 1, Roma",
          geohash: "sr1x",
          distance_m: 0.0,
          created_at: "2026-08-12T00:00:00Z",
          pseudonym: null,
          new_neighbour: false,
        },
      ],
      effective_radius_m: 500,
      target_count: 10,
      next_cursor: null,
    };
    store.mockImplementation((url: string, init?: RequestInit) => {
      if (url.startsWith("/api/feed")) {
        const cursor = new URL(url, "http://localhost").searchParams.get(
          "cursor",
        );
        const body = cursor
          ? secondPage
          : {
              ...feedWithMedia,
              next_cursor: "cursor-page-1",
            };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(body),
        });
      }
      return mockFetch()(url, init);
    });
    vi.stubGlobal("fetch", store);

    let observeCallback: IntersectionObserverCallback = () => {};
    const intersectionObserverMock = vi.fn().mockImplementation(
      (cb: IntersectionObserverCallback) => ({
        observe: vi.fn(() => {
          observeCallback = cb;
        }),
        disconnect: vi.fn(),
        unobserve: vi.fn(),
        takeRecords: vi.fn(() => []),
        root: null,
        rootMargin: "400px",
        thresholds: [0],
      }),
    );
    vi.stubGlobal("IntersectionObserver", intersectionObserverMock);

    renderApp();
    await submitAddress();

    await waitFor(() => {
      expect(screen.getByText("Ciao vicini!")).toBeInTheDocument();
    });
    expect(screen.queryByText("Un post più vecchio")).not.toBeInTheDocument();

    observeCallback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      intersectionObserverMock.mock.results[0]?.value,
    );

    await waitFor(() => {
      expect(screen.getByText("Un post più vecchio")).toBeInTheDocument();
    });
    expect(store).toHaveBeenCalledWith(
      expect.stringContaining("cursor=cursor-page-1"),
      expect.anything(),
    );
  });
});
