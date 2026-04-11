import type { WorldAndSceneConfig } from "../app/configPorts";
import type { Scene } from "../app/scenePorts";
import type { World } from "../domain/domainPorts";
import { createSceneFromWorld } from "../render/sceneAdapter";

export interface SceneSetup {
  scene: Scene;
}

export function createScene(
  world: World,
  config: WorldAndSceneConfig,
): SceneSetup {
  const scene: Scene = createSceneFromWorld(
    world,
    config.render.planets,
    config.render.ships,
  );
  return { scene };
}
