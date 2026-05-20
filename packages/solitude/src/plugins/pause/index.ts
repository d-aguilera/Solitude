import type { GamePlugin } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "../hud/capabilities";
import { createLoopPlugin } from "./core";
import { createHudPanel } from "./hud";
import { createInputPlugin } from "./input";

export function createPausePlugin(): GamePlugin {
  const { loop, controller } = createLoopPlugin();
  return {
    id: "pause",
    capabilities: [createHudPanelProvider(createHudPanel(controller))],
    input: createInputPlugin(),
    loop,
  };
}
