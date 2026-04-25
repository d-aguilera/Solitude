import type { GamePlugin } from "../../app/pluginPorts";
import { createControlPlugin } from "./core";
import { createHudPlugin } from "./hud";
import { createInputPlugin } from "./input";

export function createAutopilotPlugin(): GamePlugin {
  return {
    id: "autopilot",
    input: createInputPlugin(),
    controls: createControlPlugin(),
    hud: createHudPlugin(),
  };
}
