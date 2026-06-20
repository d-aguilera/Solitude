import {
  createSolitudeLocalization,
  type SolitudeLocale,
  type SolitudeLocalization,
} from "@solitude/localization";
import enMessages from "./locales/en.json";
import esMessages from "./locales/es.json";
import frMessages from "./locales/fr.json";

type PauseMessageTable = typeof enMessages;

export interface PauseLocalization extends SolitudeLocalization {
  readonly paused: string;
}

const messagesByLocale = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
} satisfies Record<SolitudeLocale, PauseMessageTable>;

export function createPauseLocalization(
  locale: SolitudeLocale,
): PauseLocalization {
  const base = createSolitudeLocalization(locale);
  return {
    ...base,
    paused: messagesByLocale[locale].paused,
  };
}
