import type { ExternalLocale } from "@solitude/plugin-api/localization";
import enMessages from "./locales/en.json";
import esMessages from "./locales/es.json";
import frMessages from "./locales/fr.json";

type TimeScaleMessageTable = typeof enMessages;

export interface TimeScaleLocalization {
  readonly timeScalePrefix: string;
}

const messagesByLocale = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
} satisfies Record<ExternalLocale, TimeScaleMessageTable>;

export function createTimeScaleLocalization(
  locale: ExternalLocale,
): TimeScaleLocalization {
  return messagesByLocale[locale];
}
