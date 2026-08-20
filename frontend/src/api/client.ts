import type { components, operations } from "./generated/schema";

export type FeedItem = components["schemas"]["FeedItem"];
export type FeedResponse = components["schemas"]["FeedResponse"];
export type PostCreate = components["schemas"]["PostCreate"];
export type PostScope = components["schemas"]["PostScope"];
export type PostVoice = components["schemas"]["PostVoice"];
export type PostResponse = components["schemas"]["PostResponse"];
export type DeviceResponse = components["schemas"]["DeviceResponse"];
export type DeviceUpdate = components["schemas"]["DeviceUpdate"];
export type MediaPresignRequest = components["schemas"]["MediaPresignRequest"];
export type MediaPresignResponse =
  components["schemas"]["MediaPresignResponse"];
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
    const body = (await response.json().catch(() => null)) as {
      detail?: unknown;
    } | null;
    throw new ApiError(response.status, body?.detail);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json().catch(() => undefined)) as T;
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
  if (params.cursor !== undefined && params.cursor !== null) {
    searchParams.set("cursor", params.cursor);
  }
  return request(`/api/feed?${searchParams.toString()}`);
}

export function getMe(): Promise<DeviceResponse> {
  return request("/api/me");
}

export type PushConfigResponse = components["schemas"]["PushConfigResponse"];

export function getPushConfig(): Promise<PushConfigResponse> {
  return request("/api/push/config");
}

export function subscribePush(body: {
  endpoint: string;
  p256dh: string;
  auth: string;
  address: string;
}): Promise<void> {
  return request("/api/push/subscriptions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function unsubscribePush(endpoint: string): Promise<void> {
  return request("/api/push/subscriptions", {
    method: "DELETE",
    body: JSON.stringify({ endpoint }),
  });
}

export function presignMedia(
  payload: MediaPresignRequest,
): Promise<MediaPresignResponse> {
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
    const target = new URL(url);
    const bodySnippet = (await response.text().catch(() => "")).slice(0, 200);
    throw new Error(
      `Upload failed: ${response.status} ${response.statusText}. ` +
        `PUT ${contentType} (${file.size} bytes) to ${target.host}${target.pathname} ` +
        `was rejected. Body: ${bodySnippet}.`,
    );
  }
}

export function updateMe(payload: DeviceUpdate): Promise<DeviceResponse> {
  return request("/api/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export type AnalyticsEventName = components["schemas"]["EventName"];

export async function sendAnalyticsEvents(
  events: {
    name: AnalyticsEventName;
    geohash?: string;
    post_id?: string;
    occurred_at?: string;
  }[],
): Promise<void> {
  await request("/api/events", {
    method: "POST",
    body: JSON.stringify({ events }),
  });
}

export type GeocodeResponse = components["schemas"]["GeocodeResponse"];
export type GeocodeSuggestResponse =
  components["schemas"]["GeocodeSuggestResponse"];
export type GeocodeReverseResponse =
  components["schemas"]["GeocodeReverseResponse"];
export type HeatmapTileResponse = components["schemas"]["HeatmapTileResponse"];

export type LinkPreview = components["schemas"]["LinkPreviewResponse"];

export function getLinkPreview(url: string): Promise<LinkPreview> {
  return request(`/api/preview?url=${encodeURIComponent(url)}`);
}

export function geocode(address: string): Promise<GeocodeResponse> {
  return request(`/api/geocode?address=${encodeURIComponent(address)}`);
}

export function suggestGeocode(
  q: string,
  limit = 6,
): Promise<GeocodeSuggestResponse> {
  return request(
    `/api/geocode/suggest?q=${encodeURIComponent(q)}&limit=${limit}`,
  );
}

export function reverseGeocode(
  lat: number,
  lon: number,
): Promise<GeocodeReverseResponse> {
  return request(`/api/geocode/reverse?lat=${lat}&lon=${lon}`);
}

export function getHeatmapTile(
  z: number,
  x: number,
  y: number,
): Promise<HeatmapTileResponse> {
  return request(`/api/heatmap/${z}/${x}/${y}`);
}

export type AdminPost = components["schemas"]["AdminPost"];
export type AdminFeedResponse = components["schemas"]["AdminFeedResponse"];

export function getAdminFeed(
  token: string,
  params: { limit?: number; cursor?: string | null } = {},
): Promise<AdminFeedResponse> {
  const searchParams = new URLSearchParams();
  if (params.limit !== undefined) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.cursor !== undefined && params.cursor !== null) {
    searchParams.set("cursor", params.cursor);
  }
  const query = searchParams.toString();
  return request(`/api/admin/posts${query ? `?${query}` : ""}`, {
    headers: { "X-Admin-Token": token },
  });
}
