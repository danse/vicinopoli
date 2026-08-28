import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import { AddressCombobox } from "@/components/address-combobox";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/app-context";
import { geolocationSupported, locateAddress } from "@/lib/use-browser-address";

export function AddressPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { address, setAddress } = useApp();

  // A ?address= query param (e.g. from the admin "jump into the zone" link)
  // wins over any stored address: it is applied once on mount and replaces the
  // current value, so moderators land in the zone they picked.
  const queryPrefill = useRef(searchParams.get("address"));
  useEffect(() => {
    const fromQuery = queryPrefill.current;
    if (fromQuery !== null && fromQuery.trim() !== "") {
      setAddress(fromQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opt-in location: only runs when the user clicks "use my location", never on
  // mount (the browser permission prompt is a first-visit bounce driver).
  const addressRef = useRef(address);
  addressRef.current = address;
  const [locating, setLocating] = useState(false);
  const handleLocate = async () => {
    if (locating || !geolocationSupported()) return;
    setLocating(true);
    try {
      const located = await locateAddress();
      // Never clobber an address the user has already typed.
      if (addressRef.current.trim() === "") setAddress(located);
    } catch {
      // Denied or unavailable location, or nothing to resolve: stay empty.
    } finally {
      setLocating(false);
    }
  };

  const canSubmit = address.trim() !== "";

  const submit = () => {
    if (canSubmit) navigate("/feed");
  };

  return (
    <section aria-label={t("address.title")}>
      <div className="grid gap-2">
        <p className="text-sm text-muted-foreground">{t("address.intro")}</p>
        <label
          htmlFor="address-input"
          className="text-sm font-medium text-foreground"
        >
          {t("address.title")}
        </label>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <AddressCombobox
              testId="address-input"
              address={address}
              onAddressChange={setAddress}
            />
          </div>
          <Button
            className="h-10 shrink-0"
            data-testid="address-submit"
            disabled={!canSubmit}
            onClick={submit}
          >
            {t("address.enter")}
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          data-testid="address-locate"
          disabled={locating}
          onClick={() => void handleLocate()}
          className="justify-self-start"
        >
          {locating ? t("address.locating") : t("address.locate")}
        </Button>
      </div>
    </section>
  );
}
