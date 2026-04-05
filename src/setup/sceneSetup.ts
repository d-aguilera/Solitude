import type { WorldAndSceneConfig } from "../app/configPorts";
import type { Trajectory } from "../app/runtimePorts";
import type { Scene } from "../app/scenePorts";
import type { World } from "../domain/domainPorts";
import { createSceneFromWorld } from "../render/sceneAdapter";
import { bindTrajectoryPlanToScene } from "./trajectoryBind";
import type { TrajectoryPlan } from "./trajectoryPlan";

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
