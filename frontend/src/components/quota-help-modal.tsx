import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

interface QuotaHelpModalProps {
  open: boolean;
  onClose: () => void;
}

export function QuotaHelpModal({ open, onClose }: QuotaHelpModalProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      data-testid="quota-help-dialog"
      onClose={onClose}
      className="m-auto w-full max-w-sm rounded-lg border border-input bg-card p-6 text-card-foreground shadow-lg backdrop:bg-black/50"
    >
      <h2 className="text-lg font-semibold">{t("composer.quotaHelpTitle")}</h2>
      <p className="mt-2 text-sm text-card-foreground">
        {t("composer.quotaHelpBody")}
      </p>
      <p className="mt-2 text-sm text-card-foreground">
        {t("composer.quotaHelpTrust")}
      </p>
      <Button
        className="mt-4 w-full"
        data-testid="quota-help-close"
        variant="outline"
        onClick={onClose}
      >
        {t("composer.quotaHelpClose")}
      </Button>
    </dialog>
  );
}