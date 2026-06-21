import type { RuntimeOptions } from "@solitude/engine/plugin";
import { createEntityNameProvider } from "@solitude/entity-names";
import {
  readLocaleRuntimeOption,
  type SolitudeLocale,
} from "@solitude/localization";
import enMessages from "./locales/en.json";
import esMessages from "./locales/es.json";
import frMessages from "./locales/fr.json";

type SolarSystemNameTable = typeof enMessages;

const messagesByLocale = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
} satisfies Record<SolitudeLocale, SolarSystemNameTable>;

export function createSolarSystemEntityNameProvider(
  runtimeOptions: RuntimeOptions,
) {
  const messages = messagesByLocale[readLocaleRuntimeOption(runtimeOptions)];
  return createEntityNameProvider({
    formatEntityName: (entityId) => {
      return (messages as Readonly<Record<string, string>>)[entityId] ?? null;
    },
  });
}
