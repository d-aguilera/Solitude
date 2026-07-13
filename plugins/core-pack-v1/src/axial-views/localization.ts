import type { ExternalLocale } from "@solitude/plugin-api/localization";
import enMessages from "./locales/en.json";
import esMessages from "./locales/es.json";
import frMessages from "./locales/fr.json";

export interface AxialViewsLocalization {
  front: string;
  left: string;
  right: string;
  top: string;
}

const messagesByLocale = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
} satisfies Record<ExternalLocale, AxialViewsLocalization>;

export function createAxialViewsLocalization(
  locale: ExternalLocale,
): AxialViewsLocalization {
  return messagesByLocale[locale];
}
