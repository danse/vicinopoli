import type { components, operations } from "./generated/schema";

export type FeedItem = components["schemas"]["FeedItem"];
export type FeedResponse = components["schemas"]["FeedResponse"];
export type PostCreate = components["schemas"]["PostCreate"];
export type PostScope = components["schemas"]["PostScope"];
export type PostResponse = components["schemas"]["PostResponse"];

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(
      `Request failed: ${response.status} ${response.statusText}`,
    );
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
