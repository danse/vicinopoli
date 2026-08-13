import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { type FeedResponse, getFeed } from "@/api/client";

interface FeedProps {
  address: string;
}

function formatRadius(meters: number): string {
  if (meters >= 1000) return `${meters / 1000} km`;
  return `${meters} m`;
}

export function Feed({ address }: FeedProps) {
  const { t } = useTranslation();
  const [feed, setFeed] = useState<FeedResponse | null>(null);

  useEffect(() => {
    if (address === "") {
      setFeed(null);
      return;
    }
    let cancelled = false;
    getFeed({ address })
      .then((result) => {
        if (!cancelled) setFeed(result);
      })
      .catch(() => {
        if (!cancelled)
          setFeed({ posts: [], effective_radius_m: 0, target_count: 10 });
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

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
            <p>{post.body}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {post.display_address}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
