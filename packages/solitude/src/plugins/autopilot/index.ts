import type { GamePlugin } from "@solitude/engine/app/pluginPorts";
import { createControlPlugin, createPropulsionResolverProvider } from "./core";
import { createHudPlugin } from "./hud";
import { createInputPlugin } from "./input";

export function createAutopilotPlugin(): GamePlugin {
  return {
    id: "autopilot",
    capabilities: [createPropulsionResolverProvider()],
    input: createInputPlugin(),
    controls: createControlPlugin(),
    hud: createHudPlugin(),
    requirements: {
      mainFocus: [
        "controlledBody",
        "motionState",
        "localFrame",
        "angularVelocity",
      ],
    },
  };
}
