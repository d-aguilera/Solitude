import { createKeyboardInputCapability } from "@solitude/plugin-api/capabilities";
import type {
  ExternalPlugin,
  ExternalRuntimeOptions,
} from "@solitude/plugin-api/plugin";
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
