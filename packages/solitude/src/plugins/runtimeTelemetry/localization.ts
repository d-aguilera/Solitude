import {
  createSolitudeLocalization,
  type SolitudeLocale,
  type SolitudeLocalization,
} from "@solitude/localization";
import enMessages from "./locales/en.json";
import esMessages from "./locales/es.json";
import frMessages from "./locales/fr.json";

type RuntimeTelemetryMessageTable = typeof enMessages;

export interface RuntimeTelemetryLocalization extends SolitudeLocalization {
  readonly fpsPrefix: string;
  readonly timePrefix: string;
}

const messagesByLocale = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
} satisfies Record<SolitudeLocale, RuntimeTelemetryMessageTable>;

export function createRuntimeTelemetryLocalization(
  locale: SolitudeLocale,
): RuntimeTelemetryLocalization {
  const base = createSolitudeLocalization(locale);
  const messages = messagesByLocale[locale];
  return {
    ...base,
    fpsPrefix: messages.fpsPrefix,
    timePrefix: messages.timePrefix,
  };
}
