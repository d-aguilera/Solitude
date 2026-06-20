import type { GamePlugin } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "@solitude/hud/provider";
import { createKeyboardInputProvider } from "@solitude/input/keyboard";
import { createLoopPlugin } from "./core";
import { createHudPanel } from "./hud";
import { createInputPlugin } from "./input";

export function createMemoryPlugin(): GamePlugin {
  const { plugin, controller } = createLoopPlugin();
  return {
    id: "memory",
    capabilities: [
      createHudPanelProvider(createHudPanel(controller)),
      createKeyboardInputProvider(createInputPlugin()),
    ],
    loop: plugin,
  };
}
