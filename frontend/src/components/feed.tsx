import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  type FeedResponse,
  getFeed,
  sendAnalyticsEvents,
} from "@/api/client";

interface FeedProps {
  address: string;
  refreshTick?: number;
  analyticsConsented?: boolean;
}

function formatRadius(meters: number): string {
  if (meters >= 1000) return `${meters / 1000} km`;
  return `${meters} m`;
}

export function Feed({
  address,
  refreshTick = 0,
  analyticsConsented = false,
}: FeedProps) {
  const { t } = useTranslation();
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const lastReported = useRef<string>("");

  useEffect(() => {
    if (address === "") {
      setFeed(null);
      return;
    }
    let cancelled = false;
    getFeed({ address })
      .then((result) => {
        if (!cancelled) setFeed(result);
        if (!cancelled && analyticsConsented && result.posts.length > 0) {
          const key = result.posts.map((p) => p.id).join(",");
          if (key !== lastReported.current) {
            lastReported.current = key;
            void sendAnalyticsEvents(
              result.posts.slice(0, 10).map((p) => ({
                name: "post_viewed",
                geohash: p.geohash,
              })),
            );
          }
        }
      })
      .catch(() => {
        if (!cancelled)
          setFeed({ posts: [], effective_radius_m: 0, target_count: 10 });
      });
    return () => {
      cancelled = true;
    };
  }, [address, refreshTick, analyticsConsented]);

  if (feed === null) return null;

  if (feed.posts.length === 0) {
    return (
      <section aria-label={t("composer.feedTitle")} className="mt-8">
        <p className="text-sm text-muted-foreground">{t("composer.empty")}</p>
      </section>
    );
  }

  return (
    <section aria-label={t("composer.feedTitle")} className="mt-8">
      <h2 className="text-lg font-semibold">{t("composer.feedTitle")}</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {t("composer.radius", {
          radius: formatRadius(feed.effective_radius_m),
        })}
      </p>
      <ul className="grid gap-4">
        {feed.posts.map((post) => (
          <li
            key={post.id}
            className="rounded-lg border bg-card p-4 text-card-foreground"
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
            <p>{post.body}</p>
            {post.media && post.media.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {post.media.map((item) =>
                  item.kind === "image" ? (
                    <img
                      key={item.id}
                      src={item.url}
                      alt={t("composer.photoAlt")}
                      className="h-32 w-32 rounded-md object-cover"
                    />
                  ) : (
                    <audio
                      key={item.id}
                      controls
                      src={item.url}
                      aria-label={t("composer.voiceAlt")}
                      className="max-w-full"
                    />
                  ),
                )}
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {post.display_address}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
