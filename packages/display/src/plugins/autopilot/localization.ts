import {
  createSolitudeLocalization,
  type SolitudeLocale,
  type SolitudeLocalization,
} from "@solitude/localization";
import enMessages from "./locales/en.json";
import esMessages from "./locales/es.json";
import frMessages from "./locales/fr.json";

type AutopilotMessageTable = typeof enMessages;

export interface AutopilotLocalization extends SolitudeLocalization {
  readonly body: string;
  readonly circleNow: string;
  readonly prefix: string;
  readonly velocity: string;
}

const messagesByLocale = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
} satisfies Record<SolitudeLocale, AutopilotMessageTable>;

export function createAutopilotLocalization(
  locale: SolitudeLocale,
): AutopilotLocalization {
  const base = createSolitudeLocalization(locale);
  const messages = messagesByLocale[locale];
  return {
    ...base,
    body: messages.body,
    circleNow: messages.circleNow,
    prefix: messages.prefix,
    velocity: messages.velocity,
  };
}
