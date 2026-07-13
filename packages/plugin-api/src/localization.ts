import type { ExternalRuntimeOptions } from "./plugin";

export type ExternalLocale = "en" | "es" | "fr";

export function readLocaleRuntimeOption(
  runtimeOptions: ExternalRuntimeOptions,
): ExternalLocale {
  const locale = runtimeOptions.locale;
  if (!locale) return "en";
  const language = locale.split("-")[0]?.toLowerCase();
  if (language === "es" || language === "fr") return language;
  return "en";
}
