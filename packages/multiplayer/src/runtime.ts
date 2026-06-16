import {
  captureRuntimeSnapshotInto,
  createRuntimeSnapshot,
  updateFocusContext,
} from "@solitude/engine/runtime";
import type { EntityId } from "@solitude/engine/world";
import {
  addEntityConfigToWorld,
  removeEntityFromWorld,
  type EntityConfig,
} from "@solitude/engine/world";
import type { SolitudeServerGame } from "@solitude/server/game";
import { createSolitudeHeadlessLoop } from "@solitude/sim/headless";

export function createSolitudeServerGame(
  initialEntities: readonly EntityConfig[],
): SolitudeServerGame {
  const { config, loop } = createSolitudeHeadlessLoop({
    extraEntities: initialEntities,
  });
  const snapshot = createRuntimeSnapshot();
  captureRuntimeSnapshotInto(snapshot, loop.worldAndScene.world);

  return {
    entityConfigs: config.entities,
    snapshot,
    worldAndScene: loop.worldAndScene,
    addEntity: (entity) => {
      config.entities.push(entity);
      addEntityConfigToWorld(loop.worldAndScene.world, entity);
      loop.refreshGravityState();
    },
    removeEntity: (entityId) => {
      removeEntityFromWorld(loop.worldAndScene.world, entityId);
      removeEntityConfig(config.entities, entityId);
      loop.refreshGravityState();
      if (loop.worldAndScene.mainFocus.entityId === entityId) {
        const nextFocusEntityId =
          loop.worldAndScene.world.controllableBodies[0]?.id;
        if (nextFocusEntityId) {
          updateFocusContext(
            loop.worldAndScene.world,
            loop.worldAndScene.mainFocus,
            nextFocusEntityId,
          );
        }
      }
    },
    step: (dtMillis, controlDtMillis, controlInputsByEntityId) => {
      loop.stepWithEntityInputsAndSimDt(
        controlDtMillis,
        dtMillis,
        controlInputsByEntityId,
      );
      return captureRuntimeSnapshotInto(snapshot, loop.worldAndScene.world);
    },
  };
}

function removeEntityConfig(
  entities: EntityConfig[],
  entityId: EntityId,
): void {
  let writeIndex = 0;
  for (let readIndex = 0; readIndex < entities.length; readIndex++) {
    const entity = entities[readIndex];
    if (entity.id !== entityId) {
      entities[writeIndex] = entity;
      writeIndex++;
    }
  }
  entities.length = writeIndex;
}
