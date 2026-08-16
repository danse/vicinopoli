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

vi.mock("maplibre-gl", () => ({
  default: {
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
  },
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
  created_at: "2026-08-13T00:00:00Z",
  experiment_segment: 7,
  experiment_flags: {},
  analytics_consent: null,
};
function mockFetch() {
  let consented: boolean | null = null;
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    let body: Record<string, unknown>;
    if (url === "/api/me") {
      body = { ...device, analytics_consent: consented };
    } else if (url === "/api/geocode") {
      body = {
        display_address: "Via Roma 1, Roma",
        cell: "sr1m9h",
        cell_center_latitude: 41.89,
        cell_center_longitude: 12.48,
      };
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
      };
      consented = payload.analytics_consent ?? null;
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
  });

  it("redirects the root to the address page", async () => {
    renderApp("/");
    await waitFor(() => {
      expect(screen.getByTestId("address-input")).toBeInTheDocument();
    });
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

  it("submitting an address shows the feed page", async () => {
    renderApp();
    await submitAddress();
    expect(screen.getByTestId("feed-compose")).toBeInTheDocument();
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

  it("the composer shows the address read-only with a change link back to the address page", async () => {
    renderApp();
    await openComposer();
    expect(screen.getByText("Via Roma 1, Roma")).toBeInTheDocument();
    const change = screen.getByTestId("composer-change-address");
    expect(change).toBeInTheDocument();
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
      target: { value: "Messaggio per il palazzo" },
    });
    fireEvent.click(screen.getByTestId("composer-voice-building"));
    fireEvent.click(screen.getByRole("button", { name: "Pubblica" }));

    await waitFor(() => {
      expect(screen.getByText("Ciao vicini!")).toBeInTheDocument();
    });
    const postCall = store.mock.calls.find(
      ([path]: unknown[]) => path === "/api/posts",
    );
    expect(postCall).toBeDefined();
    const init = postCall![1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({ voice: "building" });
  });

  it("uploads a photo and shows it in the feed", async () => {
    const store = mockFetch();
    vi.stubGlobal("fetch", store);

    renderApp();

    await openComposer();
    fireEvent.change(screen.getByTestId("composer-message"), {
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

  it("waits at least a second after typing stops before asking the geocoder", () => {
    // The plan: a suggest request should fire only once the full address has
    // been entered (1-2s debounce), so the production Nominatim rate limit is
    // not hit while typing.
    expect(DEBOUNCE_MS).toBeGreaterThanOrEqual(1000);
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

    let recorder: {
      state: string;
      ondataavailable: ((e: { data: Blob }) => void) | null;
      onstop: (() => void) | null;
    } = { state: "inactive", ondataavailable: null, onstop: null };
    const FakeMediaRecorder = vi.fn().mockImplementation(() => {
      recorder = { state: "inactive", ondataavailable: null, onstop: null };
      return {
        get state() {
          return recorder.state;
        },
        start: () => {
          recorder.state = "recording";
        },
        stop: () => {
          recorder.state = "inactive";
          recorder.ondataavailable?.({ data: new Blob(["voice"]) });
          recorder.onstop?.();
        },
      };
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
    fireEvent.change(screen.getByTestId("composer-message"), {
      target: { value: "Messaggio vocale" },
    });

    fireEvent.click(screen.getByTestId("composer-voice-start"));
    await waitFor(() => {
      expect(screen.getByTestId("composer-voice-stop")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("composer-voice-stop"));
    fireEvent.click(screen.getByRole("button", { name: "Pubblica" }));

    await waitFor(() => {
      expect(
        screen.getByLabelText("Messaggio vocale allegato"),
      ).toBeInTheDocument();
    });
  });
});
