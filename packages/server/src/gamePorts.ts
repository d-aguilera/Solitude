import type { ControlInput } from "@solitude/engine/plugin";
import type {
  RuntimeWorldSnapshot,
  WorldAndScene,
} from "@solitude/engine/runtime";
import type { EntityConfig, EntityId } from "@solitude/engine/world";

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
