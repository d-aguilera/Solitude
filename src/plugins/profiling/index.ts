import type { GamePlugin } from "../../app/pluginPorts";
import { createLoopPlugin } from "./core";
import { createHudPlugin } from "./hud";
import { createInputPlugin } from "./input";

export function createProfilingPlugin(): GamePlugin {
  const { plugin, controller } = createLoopPlugin();
  return {
    id: "profiling",
    input: createInputPlugin(),
    loop: plugin,
    hud: createHudPlugin(controller),
  };
}
