import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { type FeedItem, getFeed, sendAnalyticsEvents } from "@/api/client";

import { LinkPreview } from "@/components/link-preview";
import { PostMedia } from "@/components/post-media";
import { PushToggle } from "@/components/push-toggle";
import { extractFirstUrl, linkify } from "@/lib/links";

interface FeedProps {
  address: string;
  refreshTick?: number;
  analyticsConsented?: boolean;
}

function formatRadius(meters: number): string {
  if (meters >= 1000) return `${meters / 1000} km`;
  return `${meters} m`;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

export function Feed({
  address,
  refreshTick = 0,
  analyticsConsented = false,
}: FeedProps) {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<FeedItem[] | null>(null);
  const [effectiveRadius, setEffectiveRadius] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const lastReported = useRef<string>("");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const nextCursorRef = useRef<string | null>(null);

  const report = useCallback(
    (batch: FeedItem[]) => {
      if (!analyticsConsented || batch.length === 0) return;
      const key = batch.map((p) => p.id).join(",");
      if (key === lastReported.current) return;
      lastReported.current = key;
      const occurredAt = new Date().toISOString();
      void sendAnalyticsEvents(
        batch.slice(0, 10).map((p) => ({
          name: "post_viewed",
          geohash: p.geohash,
          post_id: p.id,
          occurred_at: occurredAt,
        })),
      );
    },
    [analyticsConsented],
  );

  useEffect(() => {
    if (address === "") {
      setPosts(null);
      return;
    }
    let cancelled = false;
    setPosts(null);
    setLoading(true);
    getFeed({ address })
      .then((result) => {
        if (cancelled) return;
        setPosts(result.posts);
        setEffectiveRadius(result.effective_radius_m);
        setNextCursor(result.next_cursor ?? null);
        nextCursorRef.current = result.next_cursor ?? null;
        report(result.posts);
      })
      .catch(() => {
        if (!cancelled) setPosts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address, refreshTick, report]);

  const loadMore = useCallback(async () => {
    if (loading || nextCursorRef.current === null) return;
    const cursor = nextCursorRef.current;
    setLoading(true);
    try {
      const result = await getFeed({ address, cursor });
      setPosts((prev) => [...(prev ?? []), ...result.posts]);
      setEffectiveRadius(result.effective_radius_m);
      nextCursorRef.current = result.next_cursor ?? null;
      setNextCursor(result.next_cursor ?? null);
      report(result.posts);
    } catch {
      // Keep the current page; the sentinel will retry on the next scroll.
    } finally {
      setLoading(false);
    }
  }, [address, loading, report]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (sentinel === null || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  if (posts === null) return null;

  return (
    <section aria-label={t("composer.feedTitle")} className="mt-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("composer.feedTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("composer.radius", {
              radius: formatRadius(effectiveRadius),
            })}
          </p>
        </div>
        <PushToggle address={address} />
      </div>
      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("composer.empty")}</p>
      ) : (
        <ul className="grid gap-4">
        {posts.map((post) => {
          const firstUrl = extractFirstUrl(post.body);
          return (
          <li
            key={post.id}
            data-testid="feed-post"
            className="min-w-0 rounded-lg border bg-card p-4 text-card-foreground"
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="text-sm font-semibold">
                {post.pseudonym ?? t("composer.anonymous")}
              </span>
              {post.new_neighbour && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {t("composer.newNeighbour")}
                </span>
              )}
            </div>
            {post.body.trim() !== "" && (
              <p className="break-words">
                {linkify(post.body).map((segment, index) =>
                  segment.url === undefined ? (
                    <span key={index}>{segment.text}</span>
                  ) : (
                    <a
                      key={index}
                      href={segment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="post-link"
                      className="break-all text-primary underline"
                    >
                      {segment.text}
                    </a>
                  ),
                )}
              </p>
            )}
            <PostMedia media={post.media} />
            {firstUrl !== null && <LinkPreview url={firstUrl} />}
            <p className="mt-2 text-xs text-muted-foreground">
              {post.display_address}
              {post.distance_m != null && (
                <span data-testid="feed-post-distance">
                  {" "}
                  ·{" "}
                  {t("composer.distanceFrom", {
                    distance: formatDistance(post.distance_m),
                  })}
                </span>
              )}
            </p>
          </li>
          );
        })}
        </ul>
      )}
      {nextCursor !== null && (
        <div ref={sentinelRef} data-testid="feed-load-more" aria-hidden="true" />
      )}
    </section>
  );
}
