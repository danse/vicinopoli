import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { Composer } from "@/components/composer";
import { useApp } from "@/context/app-context";

export function ComposerPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { address, pseudonym, setPseudonym, bumpFeedTick } = useApp();

  return (
    <section>
      <div className="mb-4 flex items-center justify-between rounded-md border border-input bg-card px-3 py-2 text-sm text-card-foreground">
        <span>
          {t("composer.postingNear")} <strong>{address}</strong>
        </span>
        <Link
          to="/address"
          data-testid="composer-change-address"
          className="text-sm text-primary hover:underline"
        >
          {t("composer.changeAddress")}
        </Link>
      </div>
      <Composer
        address={address}
        pseudonym={pseudonym}
        onPseudonymChange={setPseudonym}
        onPosted={() => {
          bumpFeedTick();
          navigate("/feed");
        }}
      />
    </section>
  );
}
