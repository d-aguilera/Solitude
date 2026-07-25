import type { ExternalLocale } from "@solitude/plugin-api/localization";
import enMessages from "./locales/en.json";
import esMessages from "./locales/es.json";
import frMessages from "./locales/fr.json";

type PauseMessageTable = typeof enMessages;

export interface PauseLocalization {
  readonly paused: string;
}

const messagesByLocale = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
} satisfies Record<ExternalLocale, PauseMessageTable>;

export function createPauseLocalization(
  locale: ExternalLocale,
): PauseLocalization {
  return messagesByLocale[locale];
}
