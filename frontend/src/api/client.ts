import type { components, operations } from "./generated/schema";

export type FeedItem = components["schemas"]["FeedItem"];
export type FeedResponse = components["schemas"]["FeedResponse"];
export type PostCreate = components["schemas"]["PostCreate"];
export type PostScope = components["schemas"]["PostScope"];
export type PostResponse = components["schemas"]["PostResponse"];
export type DeviceResponse = components["schemas"]["DeviceResponse"];
export type DeviceUpdate = components["schemas"]["DeviceUpdate"];
export type MediaPresignRequest = components["schemas"]["MediaPresignRequest"];
export type MediaPresignResponse = components["schemas"]["MediaPresignResponse"];
export type MediaRegistered = components["schemas"]["MediaRegistered"];
export type MediaInfo = components["schemas"]["MediaInfo"];

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: unknown,
  ) {
    super(`Request failed: ${status}`);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { detail?: unknown }
      | null;
    throw new ApiError(response.status, body?.detail);
  }
  return (await response.json()) as T;
}

export function createPost(
  body: PostCreate,
): Promise<
  operations["create_post_api_posts_post"]["responses"]["201"]["content"]["application/json"]
> {
  return request("/api/posts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getFeed(
  params: operations["get_feed_api_feed_get"]["parameters"]["query"],
): Promise<FeedResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set("address", params.address);
  if (params.target_count !== undefined) {
    searchParams.set("target_count", String(params.target_count));
  }
  if (params.search_radius_m !== undefined) {
    searchParams.set("search_radius_m", String(params.search_radius_m));
  }
  return request(`/api/feed?${searchParams.toString()}`);
}

export function getMe(): Promise<DeviceResponse> {
  return request("/api/me");
}

export function presignMedia(payload: MediaPresignRequest): Promise<MediaPresignResponse> {
  return request("/api/media/presign", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function registerMedia(
  payload: components["schemas"]["MediaRegisterRequest"],
): Promise<MediaRegistered> {
  return request("/api/media/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function uploadPhotoToUrl(
  url: string,
  file: Blob,
  contentType: string,
): Promise<void> {
  const response = await fetch(url, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": contentType },
  });
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
  }
}

export function updateMe(payload: DeviceUpdate): Promise<DeviceResponse> {
  return request("/api/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export type AnalyticsEventName = "post_viewed" | "post_created" | "onboarding_completed";

export async function sendAnalyticsEvents(
  events: { name: AnalyticsEventName; geohash?: string; post_id?: string }[],
): Promise<void> {
  await request("/api/events", {
    method: "POST",
    body: JSON.stringify({ events }),
  });
}

export type GeocodeResponse = components["schemas"]["GeocodeResponse"];
export type HeatmapTileResponse = components["schemas"]["HeatmapTileResponse"];

export function geocode(address: string): Promise<GeocodeResponse> {
  return request(`/api/geocode?address=${encodeURIComponent(address)}`);
}

export function getHeatmapTile(
  z: number,
  x: number,
  y: number,
): Promise<HeatmapTileResponse> {
  return request(`/api/heatmap/${z}/${x}/${y}`);
}
