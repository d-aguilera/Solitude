import type { GamePlugin } from "../../app/pluginPorts.js";
import { createControlPlugin } from "./core.js";
import { createHudPlugin } from "./hud.js";
import { createInputPlugin } from "./input.js";

export function createAutopilotPlugin(): GamePlugin {
  return {
    id: "autopilot",
    input: createInputPlugin(),
    controls: createControlPlugin(),
    hud: createHudPlugin(),
  };
}
