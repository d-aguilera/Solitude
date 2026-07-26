import type { ExternalLocale } from "@solitude/plugin-api/localization";
import enMessages from "./locales/en.json";
import esMessages from "./locales/es.json";
import frMessages from "./locales/fr.json";

type PlaybackMessageTable = typeof enMessages;

export interface PlaybackLocalization {
  readonly timeScalePrefix: string;
}

const messagesByLocale = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
} satisfies Record<ExternalLocale, PlaybackMessageTable>;

export function createPlaybackLocalization(
  locale: ExternalLocale,
): PlaybackLocalization {
  return messagesByLocale[locale];
}
