import type { GamePlugin } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "../hud/capabilities";
import { createLoopPlugin } from "./core";
import { createHudPanel } from "./hud";
import { createInputPlugin } from "./input";

export function createMemoryPlugin(): GamePlugin {
  const { plugin, controller } = createLoopPlugin();
  return {
    id: "memory",
    capabilities: [createHudPanelProvider(createHudPanel(controller))],
    input: createInputPlugin(),
    loop: plugin,
  };
}
