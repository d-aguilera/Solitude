import type { ExternalLocale } from "@solitude/plugin-api/localization";
import enMessages from "./locales/en.json";
import esMessages from "./locales/es.json";
import frMessages from "./locales/fr.json";

type RemoteIdentityMessages = typeof enMessages;

const messagesByLocale = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
} satisfies Record<ExternalLocale, RemoteIdentityMessages>;

export function getRemoteIdentityMessages(
  locale: ExternalLocale,
): RemoteIdentityMessages {
  return messagesByLocale[locale];
}
