import { createKeyboardInputCapability } from "@solitude/plugin-api/input";
import type { ExternalPlugin } from "@solitude/plugin-api/module";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
import { createViewControlPlugin } from "./core";
import { createInputPlugin } from "./input";

export function createPlugin(
  runtimeOptions: ExternalRuntimeOptions,
): ExternalPlugin {
  void runtimeOptions;
  return {
    id: "mainViewLookaround",
    capabilities: [createKeyboardInputCapability(createInputPlugin())],
    viewControls: createViewControlPlugin(),
  };
}
