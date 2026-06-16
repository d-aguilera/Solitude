import { mat3, vec3 } from "@solitude/engine/math";
import type { ControlInput } from "@solitude/engine/plugin";
import type { RuntimeWorldSnapshot } from "@solitude/engine/runtime";
import type { EntityConfig, EntityId } from "@solitude/engine/world";
import type { SolitudeServerGame } from "../gamePorts";
import type { SolitudeHttpServerOptions } from "../http";
import {
  DEFAULT_SOLITUDE_METRICS_WINDOW_MILLIS,
  createSolitudeServerMetrics,
} from "../metrics";
import {
  createSolitudeGameRunner,
  type SolitudeGameRunner,
  type SolitudeGameRunnerFactoryOptions,
} from "../runner";
import { createSolitudeSessionManager } from "../sessions";
import {
  DEFAULT_SOLITUDE_GAME_TICK_POLICY,
  createSolitudeGameTicker,
} from "../ticker";
import {
  createSolitudeInProcessTransport,
  type SolitudeInProcessTransport,
} from "../transport";

export function createDefaultTestHttpServerOptions(): SolitudeHttpServerOptions {
  return {
    createRunner: createDefaultTestGameRunner,
    hostname: "127.0.0.1",
    port: 8787,
  };
}

export function createDefaultTestGameRunner({
  metrics,
  onSnapshot,
}: SolitudeGameRunnerFactoryOptions): SolitudeGameRunner {
  const transport = createDefaultTestInProcessTransport();
  return createSolitudeGameRunner({
    ticker: createSolitudeGameTicker({
      metrics,
      onSnapshot,
      policy: DEFAULT_SOLITUDE_GAME_TICK_POLICY,
      transport,
    }),
    transport,
  });
}

export function createDefaultTestInProcessTransport(): SolitudeInProcessTransport {
  return createSolitudeInProcessTransport(
    createSolitudeSessionManager({
      assignableEntityIds: createTestAssignableEntityIds(16),
      createAssignableEntity: (id): EntityConfig => ({ components: {}, id }),
      createGame: (initialEntities) => createRecordingGame(initialEntities),
      nowMillis: Date.now,
    }),
  );
}

export function createDefaultTestMetrics() {
  return createSolitudeServerMetrics({
    nowMillis: Date.now,
    windowMillis: DEFAULT_SOLITUDE_METRICS_WINDOW_MILLIS,
  });
}

function createRecordingGame(
  initialEntities: readonly EntityConfig[],
): SolitudeServerGame {
  const entityConfigs = [...initialEntities];
  const snapshot: RuntimeWorldSnapshot = { entities: [] };
  refreshSnapshotEntities(snapshot, entityConfigs);

  return {
    entityConfigs,
    snapshot,
    worldAndScene: {} as SolitudeServerGame["worldAndScene"],
    addEntity: (entity) => {
      entityConfigs.push(entity);
      refreshSnapshotEntities(snapshot, entityConfigs);
    },
    removeEntity: (entityId) => {
      removeEntityConfig(entityConfigs, entityId);
      refreshSnapshotEntities(snapshot, entityConfigs);
    },
    step: (
      _dtMillis: number,
      _controlDtMillis: number,
      _controlInputsByEntityId: ReadonlyMap<EntityId, Partial<ControlInput>>,
    ) => snapshot,
  };
}

function refreshSnapshotEntities(
  snapshot: RuntimeWorldSnapshot,
  entities: readonly EntityConfig[],
): void {
  snapshot.entities.length = entities.length;
  for (let i = 0; i < entities.length; i++) {
    snapshot.entities[i] = {
      id: entities[i].id,
      orientation: mat3.identity,
      position: vec3.zero(),
      velocity: vec3.zero(),
    };
  }
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

function createTestAssignableEntityIds(count: number): EntityId[] {
  const ids = ["ship:blue", "ship:red"];
  for (let index = ids.length; index < count; index++) {
    ids.push(`ship:${index + 1}`);
  }
  return ids;
}
