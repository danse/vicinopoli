import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { updateMe } from "@/api/client";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/app-context";

export function PseudonymPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pseudonym, setPseudonym } = useApp();
  const [name, setName] = useState(pseudonym);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError(false);
    try {
      await updateMe({ pseudonym: name.trim() });
      setPseudonym(name.trim());
      navigate(-1);
    } catch {
      setError(true);
      setSaving(false);
    }
  };

  return (
    <section aria-label={t("pseudonym.title")}>
      <div className="grid gap-2">
        <label
          htmlFor="pseudonym-input"
          className="text-sm font-medium text-foreground"
        >
          {t("pseudonym.title")}
        </label>
        <input
          id="pseudonym-input"
          data-testid="pseudonym-input"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <p className="text-sm text-muted-foreground">{t("pseudonym.hint")}</p>
        {error && (
          <p data-testid="pseudonym-error" className="text-sm text-destructive">
            {t("pseudonym.error")}
          </p>
        )}
      </div>
      <Button
        className="mt-4 w-full"
        data-testid="pseudonym-submit"
        disabled={saving}
        onClick={submit}
      >
        {t("pseudonym.save")}
      </Button>
    </section>
  );
}