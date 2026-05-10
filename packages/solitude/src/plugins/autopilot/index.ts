import type { GamePlugin } from "@solitude/engine/app/pluginPorts";
import { createHudPanelProvider } from "../hud/capabilities";
import { createControlPlugin, createPropulsionResolverProvider } from "./core";
import { createHudPanel } from "./hud";
import { createInputPlugin } from "./input";

export function createAutopilotPlugin(): GamePlugin {
  return {
    id: "autopilot",
    capabilities: [
      createPropulsionResolverProvider(),
      createHudPanelProvider(createHudPanel()),
    ],
    input: createInputPlugin(),
    controls: createControlPlugin(),
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
