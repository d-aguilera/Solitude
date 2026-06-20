import {
  createSolitudeLocalization,
  type SolitudeLocale,
  type SolitudeLocalization,
} from "@solitude/localization";
import enMessages from "./locales/en.json";
import esMessages from "./locales/es.json";
import frMessages from "./locales/fr.json";

type TimeScaleMessageTable = typeof enMessages;

export interface TimeScaleLocalization extends SolitudeLocalization {
  readonly timeScalePrefix: string;
}

const messagesByLocale = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
} satisfies Record<SolitudeLocale, TimeScaleMessageTable>;

export function createTimeScaleLocalization(
  locale: SolitudeLocale,
): TimeScaleLocalization {
  const base = createSolitudeLocalization(locale);
  return {
    ...base,
    timeScalePrefix: messagesByLocale[locale].timeScalePrefix,
  };
}
