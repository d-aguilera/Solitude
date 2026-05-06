import type { GamePlugin } from "@solitude/engine/app/pluginPorts";
import { createScenePlugin } from "./core";

export function createTrajectoriesPlugin(): GamePlugin {
  return {
    id: "trajectories",
    scene: createScenePlugin(),
  };
}
