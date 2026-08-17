import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { getAdminFeed, type AdminPost } from "@/api/client";
import { PostMedia } from "@/components/post-media";
import { Button } from "@/components/ui/button";

const TOKEN_STORAGE_KEY = "vicinopoli.admin-token";
const PUBLIC_BASE_URL: string = import.meta.env.VITE_PUBLIC_BASE_URL ?? "";

function statusLabel(status: AdminPost["status"]): string {
  return status;
}

export function AdminApp() {
  const { t } = useTranslation();
  const [token, setToken] = useState(
    () => window.localStorage.getItem(TOKEN_STORAGE_KEY) ?? "",
  );
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState(false);
  const [posts, setPosts] = useState<AdminPost[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const nextCursorRef = useRef<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const login = async () => {
    setError(false);
    const trimmed = token.trim();
    if (trimmed === "") {
      setError(true);
      return;
    }
    window.localStorage.setItem(TOKEN_STORAGE_KEY, trimmed);
    await loadFirst(trimmed);
  };

  const loadFirst = useCallback(async (storedToken: string) => {
    const stored = storedToken.trim();
    if (stored === "") return;
    setLoading(true);
    try {
      const result = await getAdminFeed(stored, { limit: 20 });
      setPosts(result.posts);
      nextCursorRef.current = result.next_cursor ?? null;
      setNextCursor(result.next_cursor ?? null);
      setAuthed(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Only auto-sign-in from a token that was already stored for this browser,
  // and only on mount. A token typed in the input must wait for the button,
  // otherwise the effect fires mid-typing and swaps the form before the click.
  const storedTokenRef = useRef(
    window.localStorage.getItem(TOKEN_STORAGE_KEY) ?? "",
  );
  useEffect(() => {
    if (storedTokenRef.current.trim() !== "" && posts === null) {
      void loadFirst(storedTokenRef.current);
    }
  }, [posts, loadFirst]);

  const loadMore = useCallback(async () => {
    if (loading || nextCursorRef.current === null) return;
    const cursor = nextCursorRef.current;
    setLoading(true);
    try {
      const result = await getAdminFeed(token.trim(), {
        limit: 20,
        cursor,
      });
      setPosts((prev) => [...(prev ?? []), ...result.posts]);
      nextCursorRef.current = result.next_cursor ?? null;
      setNextCursor(result.next_cursor ?? null);
    } catch {
      // Keep the current page; the sentinel will retry on the next scroll.
    } finally {
      setLoading(false);
    }
  }, [token, loading]);

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

  if (!authed) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-4 bg-background px-4 py-8 text-foreground">
        <header>
          <h1 className="text-3xl font-bold">{t("admin.title")}</h1>
        </header>
        <section aria-label={t("admin.login")}>
          <div className="grid gap-2">
            <label
              htmlFor="admin-token"
              className="text-sm font-medium text-foreground"
            >
              {t("admin.tokenLabel")}
            </label>
            <input
              id="admin-token"
              data-testid="admin-token"
              type="password"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            {error && (
              <p data-testid="admin-error" className="text-sm text-destructive">
                {t("admin.tokenError")}
              </p>
            )}
          </div>
          <Button
            className="mt-4 w-full"
            data-testid="admin-login"
            onClick={() => void login()}
          >
            {t("admin.login")}
          </Button>
        </section>
      </main>
    );
  }

  if (posts === null) {
    return <main data-testid="admin-loading" />;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-4 bg-background px-4 py-8 text-foreground">
      <header>
        <h1 className="text-3xl font-bold">{t("admin.title")}</h1>
        <p className="text-muted-foreground">{t("admin.subtitle")}</p>
      </header>
      <ul className="grid gap-4">
        {posts.map((post) => (
          <li
            key={post.id}
            data-testid="admin-post"
            className="rounded-lg border bg-card p-4 text-card-foreground"
          >
            <div className="mb-1 flex items-center gap-2">
              <span data-testid="admin-status" className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {statusLabel(post.status)}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span data-testid="admin-report-count">{post.report_count}</span>
                <span>{t("admin.reports")}</span>
              </span>
            </div>
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
            {post.body.trim() !== "" && <p>{post.body}</p>}
            <PostMedia media={post.media} />
            <p className="mt-2 text-xs text-muted-foreground">
              {post.display_address} · {post.geohash}
            </p>
            <a
              data-testid="admin-zone-link"
              href={`${PUBLIC_BASE_URL}/address?address=${encodeURIComponent(post.display_address)}`}
              className="mt-1 inline-block text-sm text-primary hover:underline"
            >
              {t("admin.zone")}
            </a>
          </li>
        ))}
      </ul>
      {nextCursor !== null && (
        <div ref={sentinelRef} data-testid="admin-load-more" aria-hidden="true" />
      )}
    </main>
  );
}