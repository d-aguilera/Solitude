import {
  createSolitudeLocalization,
  type SolitudeLocale,
  type SolitudeLocalization,
} from "@solitude/localization";
import enMessages from "./locales/en.json";
import esMessages from "./locales/es.json";
import frMessages from "./locales/fr.json";

type ShipTelemetryMessageTable = typeof enMessages;

export interface ShipTelemetryLocalization extends SolitudeLocalization {
  readonly rcsPrefix: string;
  readonly speedPrefix: string;
  readonly thrustPrefix: string;
}

const messagesByLocale = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
} satisfies Record<SolitudeLocale, ShipTelemetryMessageTable>;

export function createShipTelemetryLocalization(
  locale: SolitudeLocale,
): ShipTelemetryLocalization {
  const base = createSolitudeLocalization(locale);
  const messages = messagesByLocale[locale];
  return {
    ...base,
    rcsPrefix: messages.rcsPrefix,
    speedPrefix: messages.speedPrefix,
    thrustPrefix: messages.thrustPrefix,
  };
}
