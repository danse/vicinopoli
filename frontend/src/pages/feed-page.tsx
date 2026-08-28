import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { Feed } from "@/components/feed";
import { Heatmap } from "@/components/heatmap";
import { HAS_POSTED_KEY } from "@/components/push-toggle";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/app-context";
import { setConsent, trackConversion } from "@/lib/analytics";

export function FeedPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { address, analyticsConsented, experimentFlags, feedTick } = useApp();
  // Ring cue on the compose button for devices that have never posted.
  const [neverPosted] = useState(
    () => localStorage.getItem(HAS_POSTED_KEY) !== "1",
  );

  // Feed-page view conversion (ADR 0026): only for users who consented.
  // Sync consent to the tag first so the conversion event is never processed
  // while the tag still holds the denied default (React runs this effect before
  // the AppProvider consent-sync effect).
  useEffect(() => {
    if (!analyticsConsented) return;
    setConsent(true);
    trackConversion();
  }, [analyticsConsented]);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between rounded-md border border-input bg-card px-3 py-2 text-sm text-card-foreground">
        <span>
          {t("feed.viewingNear")} <strong>{address}</strong>
        </span>
        <Link
          to="/address"
          data-testid="feed-change-address"
          className="text-sm text-primary hover:underline"
        >
          {t("feed.changeAddress")}
        </Link>
      </div>
      {address.trim() !== "" && experimentFlags["heatmap"] && (
        <Heatmap address={address} />
      )}
      <Feed
        address={address}
        refreshTick={feedTick}
        analyticsConsented={analyticsConsented}
      />
      <Button
        className={`fixed bottom-6 right-6 h-14 w-14 rounded-full text-2xl${neverPosted ? " fab-nudge" : ""}`}
        data-testid="feed-compose"
        aria-label={t("feed.compose")}
        onClick={() => navigate("/composer")}
      >
        +
      </Button>
    </section>
  );
}
