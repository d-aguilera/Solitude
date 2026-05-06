import type { GamePlugin } from "@solitude/engine/app/pluginPorts";
import { createLoopPlugin } from "./core";
import { createHudPlugin } from "./hud";
import { createInputPlugin } from "./input";

export function createTimeScalePlugin(): GamePlugin {
  const { plugin, controller } = createLoopPlugin();
  const hud = createHudPlugin(controller);
  return {
    id: "timeScale",
    input: createInputPlugin(),
    loop: plugin,
    hud,
  };
}
