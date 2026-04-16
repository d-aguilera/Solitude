import type { GamePlugin } from "../../app/pluginPorts";
import { createLoopPlugin } from "./core";
import { createHudPlugin } from "./hud";
import { createInputPlugin } from "./input";

export function createMemoryPlugin(): GamePlugin {
  const { plugin, controller } = createLoopPlugin();
  return {
    id: "memory",
    input: createInputPlugin(),
    loop: plugin,
    hud: createHudPlugin(controller),
  };
}
