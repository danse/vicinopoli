import { useEffect, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { ConsentBanner } from "@/components/consent-banner";
import { UpdatePrompt } from "@/components/update-prompt";
import { AppProvider, useApp } from "@/context/app-context";
import { trackPageView } from "@/lib/analytics";
import { pageTitle } from "@/lib/page-title";
import { AddressPage } from "@/pages/address-page";
import { ComposerPage } from "@/pages/composer-page";
import { FeedPage } from "@/pages/feed-page";
import { PrivacyPage } from "@/pages/privacy-page";
import { PseudonymPage } from "@/pages/pseudonym-page";
import { SupportPage } from "@/pages/support-page";

function RequireAddress({ children }: { children: ReactElement }) {
  const { address } = useApp();
  if (address.trim() === "") {
    return <Navigate to="/address" replace />;
  }
  return children;
}

function RootRedirect() {
  const { address } = useApp();
  return <Navigate to={address.trim() !== "" ? "/feed" : "/address"} replace />;
}

function AppRoutes() {
  const { t, i18n } = useTranslation();
  const { consentDecided, decideConsent } = useApp();
  const location = useLocation();

  // Report SPA route changes to the Google Ads tag (ADR 0026); a no-op when
  // no tag id is configured.
  useEffect(() => {
    trackPageView(location.pathname + location.search, document.title);
  }, [location.pathname, location.search]);

  // Page-specific tab titles (ADR 0027).
  useEffect(() => {
    document.title = pageTitle(location.pathname, t);
  }, [location.pathname, t]);

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
      {!consentDecided && location.pathname !== "/address" && (
        <ConsentBanner onDecide={(consented) => decideConsent(consented)} />
      )}
      <UpdatePrompt />
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/address" element={<AddressPage />} />
        <Route path="/pseudonym" element={<PseudonymPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route
          path="/feed"
          element={
            <RequireAddress>
              <FeedPage />
            </RequireAddress>
          }
        />
        <Route
          path="/composer"
          element={
            <RequireAddress>
              <ComposerPage />
            </RequireAddress>
          }
        />
        <Route path="*" element={<Navigate to="/address" replace />} />
      </Routes>
      <footer
        data-testid="app-footer"
        className="mt-auto flex items-center justify-between border-t pt-4 text-xs text-muted-foreground"
      >
        <p>
          {t("app.version")}{" "}
          <span data-testid="app-footer-version">{__APP_COMMIT__}</span>
        </p>
        <Link
          to="/support"
          data-testid="footer-support"
          className="text-primary hover:underline"
        >
          {t("support.title")}
        </Link>
        <Link
          to="/privacy"
          data-testid="footer-privacy"
          className="text-primary hover:underline"
        >
          {t("privacy.footerLink")}
        </Link>
      </footer>
    </main>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  );
}
