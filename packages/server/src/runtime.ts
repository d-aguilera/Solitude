import type { ControlInput } from "@solitude/engine/plugin";
import type {
  RuntimeWorldSnapshot,
  WorldAndScene,
} from "@solitude/engine/runtime";
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
import { createSolitudeHeadlessLoop } from "@solitude/sim/headless";

export type SolitudeServerControlInputs = ReadonlyMap<
  EntityId,
  Partial<ControlInput>
>;

export interface SolitudeServerGame {
  readonly entityConfigs: EntityConfig[];
  readonly snapshot: RuntimeWorldSnapshot;
  readonly worldAndScene: WorldAndScene;
  addEntity: (entity: EntityConfig) => void;
  removeEntity: (entityId: EntityId) => void;
  step: (
    dtMillis: number,
    controlInputsByEntityId: SolitudeServerControlInputs,
  ) => RuntimeWorldSnapshot;
}

export function createSolitudeServerGame(
  initialEntities?: readonly EntityConfig[],
): SolitudeServerGame {
  const { config, loop } =
    initialEntities === undefined
      ? createSolitudeHeadlessLoop()
      : createSolitudeHeadlessLoop({
          extraEntities: initialEntities,
          runtimeOptions: { ships: "dynamic" },
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
    step: (dtMillis, controlInputsByEntityId) => {
      loop.stepWithEntityInputs(dtMillis, controlInputsByEntityId);
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
