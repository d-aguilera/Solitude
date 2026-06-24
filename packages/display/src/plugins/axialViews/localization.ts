import type { SolitudeLocale } from "@solitude/localization";
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
} satisfies Record<SolitudeLocale, AxialViewsLocalization>;

export function createAxialViewsLocalization(
  locale: SolitudeLocale,
): AxialViewsLocalization {
  return messagesByLocale[locale];
}
