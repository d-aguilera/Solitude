import { createPrimaryViewDefinition } from "../../app/cameras";
import type { GamePlugin } from "../../app/pluginPorts";
import { getMainViewCameraOffset } from "../../app/renderConfigPorts";
import { createSpacecraftVehicleDynamicsPlugin } from "./core";
import { createInputPlugin } from "./input";

export function createSpacecraftOperatorPlugin(): GamePlugin {
  return {
    id: "spacecraftOperator",
    input: createInputPlugin(),
    requirements: {
      mainFocus: [
        "controlledBody",
        "motionState",
        "localFrame",
        "angularVelocity",
      ],
    },
    simulation: ({ controlPlugins }) =>
      createSpacecraftVehicleDynamicsPlugin(controlPlugins),
    views: {
      registerViews: (registry, { config }) => {
        registry.addView(
          createPrimaryViewDefinition(getMainViewCameraOffset(config.render)),
        );
      },
    },
  };
}
