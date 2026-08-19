import type { TFunction } from "i18next";

/** Human page names per route, used to set ``document.title`` (ADR 0027). */
const PAGE_TITLE_KEYS: Record<string, string> = {
  "/": "app.tagline",
  "/address": "address.title",
  "/feed": "app.tagline",
  "/support": "support.title",
};

export function pageTitle(pathname: string, t: TFunction): string {
  const key = PAGE_TITLE_KEYS[pathname] ?? "app.tagline";
  return `${t(key)} — ${t("app.title")}`;
}