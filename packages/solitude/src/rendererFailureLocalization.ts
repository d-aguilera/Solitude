import type { SolitudeLocale } from "@solitude/localization";
import enMessages from "./locales/en.json";
import esMessages from "./locales/es.json";
import frMessages from "./locales/fr.json";

type RendererFailureMessages = typeof enMessages;

const messagesByLocale = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
} satisfies Record<SolitudeLocale, RendererFailureMessages>;

export function getRendererFailureMessages(
  locale: SolitudeLocale,
): RendererFailureMessages {
  return messagesByLocale[locale];
}
