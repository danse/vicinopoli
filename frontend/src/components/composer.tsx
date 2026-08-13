import { useState } from "react";
import { useTranslation } from "react-i18next";

import { createPost, updateMe } from "@/api/client";
import { Button } from "@/components/ui/button";

interface ComposerProps {
  address: string;
  onAddressChange: (address: string) => void;
  pseudonym: string;
  onPseudonymChange: (pseudonym: string) => void;
  onPosted: () => void;
}

export function Composer({
  address,
  onAddressChange,
  pseudonym,
  onPseudonymChange,
  onPosted,
}: ComposerProps) {
  const { t } = useTranslation();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  const canSubmit = address.trim() !== "" && body.trim() !== "" && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(false);
    try {
      if (pseudonym.trim() !== "") {
        await updateMe({ pseudonym: pseudonym.trim() });
      }
      await createPost({
        address: address.trim(),
        body: body.trim(),
        scope: "1km",
      });
      setBody("");
      onPosted();
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-label={t("composer.feedTitle")}>
      <div className="grid gap-2">
        <label
          htmlFor="composer-address"
          className="text-sm font-medium text-foreground"
        >
          {t("composer.addressLabel")}
        </label>
        <input
          id="composer-address"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={address}
          placeholder={t("composer.addressPlaceholder")}
          onChange={(e) => onAddressChange(e.target.value)}
        />
      </div>
      <div className="mt-4 grid gap-2">
        <label
          htmlFor="composer-pseudonym"
          className="text-sm font-medium text-foreground"
        >
          {t("composer.pseudonymLabel")}
        </label>
        <input
          id="composer-pseudonym"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={pseudonym}
          placeholder={t("composer.pseudonymPlaceholder")}
          onChange={(e) => onPseudonymChange(e.target.value)}
        />
      </div>
      <div className="mt-4 grid gap-2">
        <label
          htmlFor="composer-message"
          className="text-sm font-medium text-foreground"
        >
          {t("composer.messageLabel")}
        </label>
        <textarea
          id="composer-message"
          className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={body}
          placeholder={t("composer.messagePlaceholder")}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      {error && (
        <p className="mt-2 text-sm text-destructive">{t("composer.error")}</p>
      )}
      <Button className="mt-4" disabled={!canSubmit} onClick={handleSubmit}>
        {submitting ? t("composer.publishing") : t("composer.publish")}
      </Button>
    </section>
  );
}
