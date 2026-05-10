import type { GamePlugin } from "@solitude/engine/app/pluginPorts";
import { createHudPanelProvider } from "../hud/capabilities";
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
