import {
  createSolitudeLocalization,
  type SolitudeLocale,
  type SolitudeLocalization,
} from "@solitude/sim/localization";
import enMessages from "./locales/en.json";
import esMessages from "./locales/es.json";
import frMessages from "./locales/fr.json";

type ProfilingMessageTable = typeof enMessages;

export interface ProfilingLocalization extends SolitudeLocalization {
  readonly profiling: string;
}

const messagesByLocale = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
} satisfies Record<SolitudeLocale, ProfilingMessageTable>;

export function createProfilingLocalization(
  locale: SolitudeLocale,
): ProfilingLocalization {
  const base = createSolitudeLocalization(locale);
  return {
    ...base,
    profiling: messagesByLocale[locale].profiling,
  };
}
