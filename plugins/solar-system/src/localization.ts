import { createEntityNameProvider } from "@solitude/plugin-api/entity-names";
import {
  readLocaleRuntimeOption,
  type ExternalLocale,
} from "@solitude/plugin-api/localization";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
import enMessages from "./locales/en.json";
import esMessages from "./locales/es.json";
import frMessages from "./locales/fr.json";

type SolarSystemNameTable = typeof enMessages;

const messagesByLocale = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
} satisfies Record<ExternalLocale, SolarSystemNameTable>;

export function createSolarSystemEntityNameProvider(
  runtimeOptions: ExternalRuntimeOptions,
) {
  const messages = messagesByLocale[readLocaleRuntimeOption(runtimeOptions)];
  return createEntityNameProvider({
    formatEntityName: (entityId) => {
      return (messages as Readonly<Record<string, string>>)[entityId] ?? null;
    },
  });
}
