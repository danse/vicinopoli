import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

const SUPPORT_EMAIL: string = import.meta.env.VITE_SUPPORT_EMAIL ?? "";

export function SupportPage() {
  const { t } = useTranslation();

  return (
    <section aria-label={t("support.title")}>
      <h2 className="text-xl font-semibold">{t("support.title")}</h2>
      <p className="text-sm text-muted-foreground">
        {t("support.hint", { email: SUPPORT_EMAIL })}
      </p>
      <a
        data-testid="support-email"
        href={`mailto:${SUPPORT_EMAIL}`}
        className="mt-2 inline-block text-primary hover:underline"
      >
        {SUPPORT_EMAIL}
      </a>
      <Button
        className="mt-4 w-full"
        data-testid="support-back"
        variant="outline"
        asChild
      >
        <Link to="/address">{t("support.back")}</Link>
      </Button>
    </section>
  );
}