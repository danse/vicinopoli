import { useState } from "react";
import { useTranslation } from "react-i18next";

import { sendAnalyticsEvents, updateMe } from "@/api/client";
import { Button } from "@/components/ui/button";

interface ConsentBannerProps {
  onDecide: (consented: boolean) => void;
}

export function ConsentBanner({ onDecide }: ConsentBannerProps) {
  const { t } = useTranslation();
  const [leaving, setLeaving] = useState(false);

  const decide = async (consented: boolean) => {
    setLeaving(true);
    try {
      await updateMe({ analytics_consent: consented });
      if (consented) {
        await sendAnalyticsEvents([{ name: "onboarding_completed" }]);
      }
    } catch {
      // Consent is best-effort; the user flow must not be blocked.
    }
    onDecide(consented);
  };

  return (
    <div
      role="dialog"
      aria-label={t("consent.title")}
      className="rounded-lg border bg-background p-4 shadow-lg"
    >
      <h2 className="text-sm font-semibold">{t("consent.title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("consent.body")}</p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" disabled={leaving} onClick={() => decide(true)}>
          {t("consent.accept")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={leaving}
          onClick={() => decide(false)}
        >
          {t("consent.decline")}
        </Button>
      </div>
    </div>
  );
}
