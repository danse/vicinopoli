import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

export default function App() {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const next = i18n.language === "it" ? "en" : "it";
    void i18n.changeLanguage(next);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <h1 className="text-3xl font-bold">{t("app.title")}</h1>
      <p className="text-muted-foreground">{t("app.tagline")}</p>
      <Button onClick={toggleLanguage}>{t("app.switchLanguage")}</Button>
    </main>
  );
}
