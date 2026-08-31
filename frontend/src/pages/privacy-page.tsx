import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

const SUPPORT_EMAIL: string = import.meta.env.VITE_SUPPORT_EMAIL ?? "";

export function PrivacyPage() {
  const { t } = useTranslation();

  return (
    <section aria-label={t("privacy.title")} data-testid="privacy-page">
      <h2 className="text-xl font-semibold">{t("privacy.title")}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t("privacy.intro")}</p>

      <h3 className="mt-4 text-base font-semibold">{t("privacy.cookiesTitle")}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("privacy.cookiesBody1")}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("privacy.cookiesBody2")}
      </p>

      <h3 className="mt-4 text-base font-semibold">{t("privacy.localTitle")}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("privacy.localBody")}
      </p>

      <h3 className="mt-4 text-base font-semibold">{t("privacy.serverTitle")}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("privacy.serverBody1")}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("privacy.serverBody2")}
      </p>

      <h3 className="mt-4 text-base font-semibold">
        {t("privacy.noAccountsTitle")}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("privacy.noAccountsBody")}
      </p>

      <h3 className="mt-4 text-base font-semibold">
        {t("privacy.contactTitle")}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("privacy.contactBody")}{" "}
        <a
          data-testid="privacy-email"
          href={`mailto:${SUPPORT_EMAIL}`}
          className="text-primary hover:underline"
        >
          {SUPPORT_EMAIL}
        </a>
      </p>

      <Button className="mt-4 w-full" variant="outline" asChild>
        <Link to="/address" data-testid="privacy-back">
          {t("support.back")}
        </Link>
      </Button>
    </section>
  );
}