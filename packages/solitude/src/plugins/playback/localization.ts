import {
  createSolitudeLocalization,
  type SolitudeLocale,
  type SolitudeLocalization,
} from "@solitude/localization";
import enMessages from "./locales/en.json";
import esMessages from "./locales/es.json";
import frMessages from "./locales/fr.json";

type PlaybackMessageTable = typeof enMessages;

export interface PlaybackLocalization extends SolitudeLocalization {
  readonly timeScalePrefix: string;
}

const messagesByLocale = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
} satisfies Record<SolitudeLocale, PlaybackMessageTable>;

export function createPlaybackLocalization(
  locale: SolitudeLocale,
): PlaybackLocalization {
  const base = createSolitudeLocalization(locale);
  return {
    ...base,
    timeScalePrefix: messagesByLocale[locale].timeScalePrefix,
  };
}
