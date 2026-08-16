import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { Feed } from "@/components/feed";
import { Heatmap } from "@/components/heatmap";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/app-context";

export function FeedPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { address, analyticsConsented, experimentFlags, feedTick } = useApp();

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
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full text-2xl"
        data-testid="feed-compose"
        aria-label={t("feed.compose")}
        onClick={() => navigate("/composer")}
      >
        +
      </Button>
    </section>
  );
}
