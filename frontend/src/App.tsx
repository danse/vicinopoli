import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Composer } from "@/components/composer";
import { Feed } from "@/components/feed";

export default function App() {
  const { t, i18n } = useTranslation();
  const [address, setAddress] = useState("");

  const toggleLanguage = () => {
    const next = i18n.language === "it" ? "en" : "it";
    void i18n.changeLanguage(next);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-4 bg-background px-4 py-8 text-foreground">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("app.title")}</h1>
          <p className="text-muted-foreground">{t("app.tagline")}</p>
        </div>
        <button
          onClick={toggleLanguage}
          className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent"
        >
          {t("app.switchLanguage")}
        </button>
      </header>
      <Composer address={address} onAddressChange={setAddress} />
      <Feed address={address} />
    </main>
  );
}
