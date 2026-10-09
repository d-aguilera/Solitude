import type { RuntimeOptions } from "@solitude/engine/plugin";
import {
  standaloneGenerationOption,
  standaloneModeOption,
  type StandaloneMode,
} from "@solitude/plugin-api/standalone-session";

export type StandaloneEntry =
  { kind: "menu" } | { kind: "error" } | { kind: "run"; mode: StandaloneMode };
export function resolveStandaloneEntry(
  options: RuntimeOptions,
): StandaloneEntry {
  if (options.mode !== undefined) {
    return options.mode === "my-first-orbit" || options.mode === "free-flight"
      ? { kind: "run", mode: options.mode }
      : { kind: "error" };
  }
  return Object.keys(options).some(
    (key) =>
      key !== "locale" &&
      key !== standaloneModeOption &&
      key !== standaloneGenerationOption,
  )
    ? { kind: "run", mode: "free-flight" }
    : { kind: "menu" };
}
export function createRunOptions(
  base: RuntimeOptions,
  mode: StandaloneMode,
  generation: number,
): RuntimeOptions {
  const options: Record<string, string> =
    mode === "my-first-orbit"
      ? { locale: base.locale ?? "en", orbitalSpeedMultiplier: "1" }
      : { ...base };
  delete options.mode;
  options[standaloneModeOption] = mode;
  options[standaloneGenerationOption] = String(generation);
  return options;
}
export function menuUrl(href: string): string {
  const url = new URL(href);
  const locale = url.searchParams.get("locale");
  url.search = "";
  if (locale) url.searchParams.set("locale", locale);
  return url.href;
}
