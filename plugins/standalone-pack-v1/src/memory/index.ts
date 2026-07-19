import {
  createHudPanelCapability,
  type ExternalHudPanelProvider,
} from "@solitude/plugin-api/hud";
import {
  createKeyboardInputCapability,
  type ExternalKeyboardInputProvider,
} from "@solitude/plugin-api/input";
import type { ExternalPlugin } from "@solitude/plugin-api/module";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
import { createLoopPlugin } from "./core";
import { createHudPanel } from "./hud";
import { createInputPlugin } from "./input";

export function createPlugin(
  _runtimeOptions: ExternalRuntimeOptions,
): ExternalPlugin {
  const { plugin, controller } = createLoopPlugin();
  const hud: ExternalHudPanelProvider = createHudPanel(controller);
  const input: ExternalKeyboardInputProvider = createInputPlugin();
  return {
    id: "memory",
    capabilities: [
      createHudPanelCapability(hud),
      createKeyboardInputCapability(input),
    ],
    hooks: { loop: plugin },
  };
}
