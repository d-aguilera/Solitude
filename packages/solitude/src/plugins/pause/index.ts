import type { GamePlugin } from "@solitude/engine/app/pluginPorts";
import { createLoopPlugin } from "./core";
import { createHudPlugin } from "./hud";
import { createInputPlugin } from "./input";

export function createPausePlugin(): GamePlugin {
  const { loop, controller } = createLoopPlugin();
  return {
    id: "pause",
    hud: createHudPlugin(controller),
    input: createInputPlugin(),
    loop,
  };
}
