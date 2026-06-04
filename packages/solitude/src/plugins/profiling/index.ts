import type { GamePlugin } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "@solitude/sim/hud/provider";
import { createLoopPlugin } from "./core";
import { createHudPanel } from "./hud";
import { createInputPlugin } from "./input";

export function createProfilingPlugin(): GamePlugin {
  const { plugin, controller } = createLoopPlugin();
  return {
    id: "profiling",
    capabilities: [createHudPanelProvider(createHudPanel(controller))],
    input: createInputPlugin(),
    loop: plugin,
  };
}
