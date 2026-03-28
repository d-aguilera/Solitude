import type { WorldAndSceneConfig } from "../app/configPorts.js";
import type { Trajectory } from "../app/runtimePorts.js";
import type { Scene } from "../app/scenePorts.js";
import type { World } from "../domain/domainPorts.js";
import { createSceneFromWorld } from "../render/sceneAdapter.js";
import { bindTrajectoryPlanToScene } from "./trajectoryBind.js";
import type { TrajectoryPlan } from "./trajectoryPlan.js";

export interface SceneSetup {
  scene: Scene;
  trajectoryList: Trajectory[];
}

export function createSceneAndTrajectories(
  world: World,
  config: WorldAndSceneConfig,
  trajectoryPlan: TrajectoryPlan[],
): SceneSetup {
  const scene: Scene = createSceneFromWorld(
    world,
    config.render.planets,
    config.render.ships,
  );

  const trajectoryList = bindTrajectoryPlanToScene(scene, trajectoryPlan);

  return { scene, trajectoryList };
}
