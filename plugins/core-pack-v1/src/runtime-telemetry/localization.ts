import type { ExternalLocale } from "@solitude/plugin-api/localization";
import {
  createPluginLocalization,
  type PluginLocalization,
} from "../shared/localization";
import enMessages from "./locales/en.json";
import esMessages from "./locales/es.json";
import frMessages from "./locales/fr.json";

type RuntimeTelemetryMessageTable = typeof enMessages;

export interface RuntimeTelemetryLocalization extends PluginLocalization {
  readonly fpsPrefix: string;
  readonly timePrefix: string;
}

const messagesByLocale = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
} satisfies Record<ExternalLocale, RuntimeTelemetryMessageTable>;

export function createRuntimeTelemetryLocalization(
  locale: ExternalLocale,
): RuntimeTelemetryLocalization {
  const base = createPluginLocalization(locale);
  const messages = messagesByLocale[locale];
  return {
    ...base,
    fpsPrefix: messages.fpsPrefix,
    timePrefix: messages.timePrefix,
  };
}
