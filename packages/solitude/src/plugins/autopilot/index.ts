import type { GamePlugin } from "@solitude/engine/app/pluginPorts";
import { createHudPanelProvider } from "../hud/capabilities";
import {
  createAutonomousControlProvider,
  createControlPlugin,
  createPropulsionResolverProvider,
} from "./core";
import { createHudPanel } from "./hud";
import { createInputPlugin } from "./input";

export function createAutopilotPlugin(): GamePlugin {
  return {
    id: "autopilot",
    capabilities: [
      createAutonomousControlProvider(),
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
