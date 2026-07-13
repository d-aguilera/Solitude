import {
  createKeyboardInputCapability,
  type ExternalPlugin,
  type ExternalRuntimeOptions,
} from "@solitude/plugin-api";
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
