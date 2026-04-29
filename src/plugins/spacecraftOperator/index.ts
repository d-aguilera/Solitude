import type { GamePlugin } from "../../app/pluginPorts";
import { createSpacecraftVehicleDynamicsPlugin } from "./core";

export function createSpacecraftOperatorPlugin(): GamePlugin {
  return {
    id: "spacecraftOperator",
    simulation: ({ controlPlugins }) =>
      createSpacecraftVehicleDynamicsPlugin(controlPlugins),
  };
}
