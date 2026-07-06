import type { GamePlugin, RuntimeOptions } from "@solitude/engine/plugin";
import { createKeyboardInputProvider } from "@solitude/input/keyboard";
import { createInputPlugin } from "../../autopilot/input";

export function createAutopilotInputPlugin(
  runtimeOptions: RuntimeOptions = {},
): GamePlugin {
  void runtimeOptions;
  return {
    id: "autopilotInput",
    capabilities: [createKeyboardInputProvider(createInputPlugin())],
  };
}
