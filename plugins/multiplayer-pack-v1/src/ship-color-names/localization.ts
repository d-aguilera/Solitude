import type { ExternalLocale } from "@solitude/plugin-api/localization";
import enNames from "./locales/en.json";
import esNames from "./locales/es.json";
import frNames from "./locales/fr.json";

export type ShipColorNameKey = keyof typeof enNames;
export type ShipColorNames = Readonly<Record<ShipColorNameKey, string>>;

const namesByLocale = {
  en: enNames,
  es: esNames,
  fr: frNames,
} satisfies Record<ExternalLocale, ShipColorNames>;

export function getShipColorNames(locale: ExternalLocale): ShipColorNames {
  return namesByLocale[locale];
}
