import { useTranslation } from "react-i18next";
import { useRegisterSW } from "virtual:pwa-register/react";

import { Button } from "@/components/ui/button";

export function UpdatePrompt() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const close = () => {
    setNeedRefresh(false);
  };

  if (!needRefresh) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-label={t("update.available")}
      data-testid="update-prompt"
      className="flex items-center justify-between gap-3 rounded-lg border bg-background p-4 shadow-lg"
    >
      <p className="text-sm text-foreground">{t("update.available")}</p>
      <div className="flex shrink-0 gap-2">
        {needRefresh && (
          <Button size="sm" onClick={() => void updateServiceWorker(true)}>
            <span data-testid="update-prompt-reload">
              {t("update.reload")}
            </span>
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={close}>
          <span data-testid="update-prompt-close">{t("update.close")}</span>
        </Button>
      </div>
    </div>
  );
}