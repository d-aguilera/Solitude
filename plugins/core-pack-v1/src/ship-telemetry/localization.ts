import type { ExternalLocale } from "@solitude/plugin-api";
import {
  createPluginLocalization,
  type PluginLocalization,
} from "../shared/localization";
import enMessages from "./locales/en.json";
import esMessages from "./locales/es.json";
import frMessages from "./locales/fr.json";

type ShipTelemetryMessageTable = typeof enMessages;

export interface ShipTelemetryLocalization extends PluginLocalization {
  readonly rcsPrefix: string;
  readonly speedPrefix: string;
  readonly thrustPrefix: string;
}

const messagesByLocale = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
} satisfies Record<ExternalLocale, ShipTelemetryMessageTable>;

export function createShipTelemetryLocalization(
  locale: ExternalLocale,
): ShipTelemetryLocalization {
  const base = createPluginLocalization(locale);
  const messages = messagesByLocale[locale];
  return {
    ...base,
    rcsPrefix: messages.rcsPrefix,
    speedPrefix: messages.speedPrefix,
    thrustPrefix: messages.thrustPrefix,
  };
}
