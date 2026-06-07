import type { GamePlugin } from "@solitude/engine/plugin";
import { createScenePlugin } from "./core";

export function createTrajectoriesPlugin(): GamePlugin {
  return {
    id: "trajectories",
    scene: createScenePlugin(),
  };
}
