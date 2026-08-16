import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { Feed } from "@/components/feed";
import { Heatmap } from "@/components/heatmap";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/app-context";

export function FeedPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { address, analyticsConsented, feedTick } = useApp();

  return (
    <section>
      {address.trim() !== "" && <Heatmap address={address} />}
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
