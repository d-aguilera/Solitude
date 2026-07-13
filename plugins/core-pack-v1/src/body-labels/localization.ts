import type { ExternalLocale } from "@solitude/plugin-api";
import {
  createPluginLocalization,
  type PluginLocalization,
} from "../shared/localization";
import enMessages from "./locales/en.json";
import esMessages from "./locales/es.json";
import frMessages from "./locales/fr.json";

type BodyLabelMessageTable = typeof enMessages;

export interface BodyLabelLocalization extends PluginLocalization {
  distanceLabel: (distance: string) => string;
  velocityLabel: (speed: string) => string;
}

const messagesByLocale = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
} satisfies Record<ExternalLocale, BodyLabelMessageTable>;

export function createBodyLabelLocalization(
  locale: ExternalLocale,
): BodyLabelLocalization {
  const base = createPluginLocalization(locale);
  const messages = messagesByLocale[locale];
  return {
    ...base,
    distanceLabel: (distance) =>
      base.formatMessage(messages.distanceLabel, { distance }),
    velocityLabel: (speed) =>
      base.formatMessage(messages.velocityLabel, { speed }),
  };
}
