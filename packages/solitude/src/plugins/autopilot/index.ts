import type { GamePlugin } from "@solitude/engine/plugin";
import {
  createAutonomousControlProvider,
  createControlPlugin,
  createPropulsionResolverProvider,
} from "@solitude/sim/plugins/autopilot/core";
import { createInputPlugin } from "@solitude/sim/plugins/autopilot/input";
import { createHudPanelProvider } from "../hud/capabilities";
import { createHudPanel } from "./hud";

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
