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
  validateRenderedWorldConfig(config);

  const scene: Scene = createSceneFromWorld(world, config);
  return { scene };
}

function validateRenderedWorldConfig(config: WorldAndSceneConfig): void {
  if (config.entities.length === 0) {
    throw new Error("World config is missing rendered entities");
  }
  validateRenderedEntityConfig(config);
}

function validateRenderedEntityConfig(config: WorldAndSceneConfig): void {
  const renderedEntityIds = new Set<string>();
  for (const entity of config.entities) {
    if (entity.components.renderable) {
      renderedEntityIds.add(entity.id);
    }
  }

  for (const entity of config.entities) {
    if (!entity.components.controllable) continue;
    if (!renderedEntityIds.has(entity.id)) {
      throw new Error(
        `Controllable entity render config not found: ${entity.id}`,
      );
    }
  }

  if (!renderedEntityIds.has(config.mainControlledEntityId)) {
    throw new Error(
      `Main controlled entity render config not found: ${config.mainControlledEntityId}`,
    );
  }
}
