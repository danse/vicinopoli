import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { getLinkPreview, type LinkPreview as LinkPreviewData } from "@/api/client";

interface LinkPreviewProps {
  url: string;
}

export function LinkPreview({ url }: LinkPreviewProps) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    setFailed(false);
    getLinkPreview(url)
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (failed) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="link-preview"
      className="mt-2 flex overflow-hidden rounded-md border border-input bg-muted/40 text-card-foreground no-underline hover:border-primary"
    >
      {preview === null ? (
        <span className="p-3 text-xs text-muted-foreground">
          {t("preview.loading")}
        </span>
      ) : (
        <>
          {preview.image_url !== null && (
            <img
              src={preview.image_url}
              alt=""
              loading="lazy"
              className="h-24 w-24 shrink-0 object-cover"
            />
          )}
          <span className="flex min-w-0 flex-col justify-center gap-1 p-3">
            <span className="line-clamp-2 text-sm font-semibold">
              {preview.title ?? url}
            </span>
            {preview.description !== null &&
              preview.description !== "" && (
                <span className="line-clamp-2 text-xs text-muted-foreground">
                  {preview.description}
                </span>
              )}
            <span className="truncate text-xs text-muted-foreground">
              {preview.provider_name ?? url}
            </span>
          </span>
        </>
      )}
    </a>
  );
}