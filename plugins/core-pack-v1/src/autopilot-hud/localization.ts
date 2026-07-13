import type { ExternalLocale } from "@solitude/plugin-api";
import {
  createPluginLocalization,
  type PluginLocalization,
} from "../shared/localization";
import enMessages from "./locales/en.json";
import esMessages from "./locales/es.json";
import frMessages from "./locales/fr.json";

type AutopilotMessageTable = typeof enMessages;

export interface AutopilotLocalization extends PluginLocalization {
  readonly body: string;
  readonly circleNow: string;
  readonly orbit: string;
  readonly prefix: string;
  readonly velocity: string;
}

const messagesByLocale = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
} satisfies Record<ExternalLocale, AutopilotMessageTable>;

export function createAutopilotLocalization(
  locale: ExternalLocale,
): AutopilotLocalization {
  const base = createPluginLocalization(locale);
  const messages = messagesByLocale[locale];
  return {
    ...base,
    body: messages.body,
    circleNow: messages.circleNow,
    orbit: messages.orbit,
    prefix: messages.prefix,
    velocity: messages.velocity,
  };
}
