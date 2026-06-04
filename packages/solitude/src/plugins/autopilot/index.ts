import type { GamePlugin } from "@solitude/engine/plugin";
import { createHudPanelProvider } from "@solitude/sim/hud/provider";
import {
  createAutonomousControlProvider,
  createControlPlugin,
  createPropulsionResolverProvider,
} from "@solitude/sim/plugins/autopilot/core";
import { createInputPlugin } from "@solitude/sim/plugins/autopilot/input";
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
