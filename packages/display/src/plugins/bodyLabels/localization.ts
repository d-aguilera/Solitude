import {
  createSolitudeLocalization,
  type SolitudeLocale,
  type SolitudeLocalization,
} from "@solitude/localization";
import enMessages from "./locales/en.json";
import esMessages from "./locales/es.json";
import frMessages from "./locales/fr.json";

type BodyLabelMessageTable = typeof enMessages;

export interface BodyLabelLocalization extends SolitudeLocalization {
  distanceLabel: (distance: string) => string;
  velocityLabel: (speed: string) => string;
}

const messagesByLocale = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
} satisfies Record<SolitudeLocale, BodyLabelMessageTable>;

export function createBodyLabelLocalization(
  locale: SolitudeLocale,
): BodyLabelLocalization {
  const base = createSolitudeLocalization(locale);
  const messages = messagesByLocale[locale];
  return {
    ...base,
    distanceLabel: (distance) =>
      base.formatMessage(messages.distanceLabel, { distance }),
    velocityLabel: (speed) =>
      base.formatMessage(messages.velocityLabel, { speed }),
  };
}
