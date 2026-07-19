import type { ExternalLocale } from "@solitude/plugin-api/localization";
import enMessages from "./locales/en.json";
import esMessages from "./locales/es.json";
import frMessages from "./locales/fr.json";

type ProfilingMessageTable = typeof enMessages;

export interface ProfilingLocalization {
  readonly profiling: string;
}

const messagesByLocale = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
} satisfies Record<ExternalLocale, ProfilingMessageTable>;

export function createProfilingLocalization(
  locale: ExternalLocale,
): ProfilingLocalization {
  return messagesByLocale[locale];
}
