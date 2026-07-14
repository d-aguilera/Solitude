import type { ExternalPlugin } from "@solitude/plugin-api/module";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
import { createSegmentsPlugin } from "./core";

export function createPlugin(
  _runtimeOptions: ExternalRuntimeOptions,
): ExternalPlugin {
  return {
    id: "velocitySegments",
    hooks: { segments: createSegmentsPlugin() },
  };
}
