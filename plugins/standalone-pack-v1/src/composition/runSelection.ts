import type { ExternalPlugin } from "@solitude/plugin-api/module";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
import { standaloneModeOption } from "@solitude/plugin-api/standalone-entry";

/** Product composition owns feature selection, before reusable factories run. */
export function isFirstOrbit(options: ExternalRuntimeOptions): boolean {
  return options[standaloneModeOption] === "my-first-orbit";
}

export function selectSandboxPlugin<Context extends unknown[]>(
  id: string,
  factory: (
    options: ExternalRuntimeOptions,
    ...context: Context
  ) => ExternalPlugin,
) {
  return (
    options: ExternalRuntimeOptions,
    ...context: Context
  ): ExternalPlugin =>
    isFirstOrbit(options) ? { id } : factory(options, ...context);
}
