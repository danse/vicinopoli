import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { AddressCombobox } from "@/components/address-combobox";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/app-context";

export function AddressPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { address, setAddress } = useApp();

  const canSubmit = address.trim() !== "";

  const submit = () => {
    if (canSubmit) navigate("/feed");
  };

  return (
    <section aria-label={t("address.title")}>
      <div className="grid gap-2">
        <label
          htmlFor="address-input"
          className="text-sm font-medium text-foreground"
        >
          {t("address.title")}
        </label>
        <AddressCombobox
          testId="address-input"
          address={address}
          onAddressChange={setAddress}
        />
        <p className="text-sm text-muted-foreground">{t("address.hint")}</p>
      </div>
      <Button
        className="mt-4 w-full"
        data-testid="address-submit"
        disabled={!canSubmit}
        onClick={submit}
      >
        {t("address.enter")}
      </Button>
    </section>
  );
}
