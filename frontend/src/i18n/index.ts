import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import it from "./locales/it.json";
import zh from "./locales/zh.json";

i18n.use(initReactI18next).init({
  resources: {
    it: { translation: it },
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: "it",
  fallbackLng: "it",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
