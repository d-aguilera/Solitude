import type { GamePlugin, RuntimeOptions } from "@solitude/engine/plugin";
import {
  createAutonomousControlProvider,
  createControlPlugin,
  createPropulsionResolverProvider,
} from "./core";

export function createAutopilotBehaviorPlugin(
  runtimeOptions: RuntimeOptions = {},
): GamePlugin {
  void runtimeOptions;
  return {
    id: "autopilot",
    capabilities: [
      createAutonomousControlProvider(),
      createPropulsionResolverProvider(),
    ],
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
