import { useTranslation } from "react-i18next";

import type { MediaInfo } from "@/api/client";

export function PostMedia({ media }: { media?: MediaInfo[] | null }) {
  const { t } = useTranslation();
  if (!media || media.length === 0) return null;
  return (
    <div className="mt-2 flex flex-col gap-2">
      {media.map((item) =>
        item.kind === "image" ? (
          <img
            key={item.id}
            src={item.url}
            alt={t("composer.photoAlt")}
            className="w-full rounded-md object-cover"
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
  );
}