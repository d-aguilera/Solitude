import type { GamePlugin } from "../../app/pluginPorts";
import { createSpacecraftVehicleDynamicsPlugin } from "./core";
import { createInputPlugin } from "./input";

export function createSpacecraftOperatorPlugin(): GamePlugin {
  return {
    id: "spacecraftOperator",
    input: createInputPlugin(),
    simulation: ({ controlPlugins }) =>
      createSpacecraftVehicleDynamicsPlugin(controlPlugins),
  };
}
