import type { GamePlugin } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "../hud/capabilities";
import { createLoopPlugin } from "./core";
import { createHudPanel } from "./hud";
import { createInputPlugin } from "./input";

export function createTimeScalePlugin(): GamePlugin {
  const { plugin, controller } = createLoopPlugin();
  return {
    id: "timeScale",
    capabilities: [createHudPanelProvider(createHudPanel(controller))],
    input: createInputPlugin(),
    loop: plugin,
  };
}
