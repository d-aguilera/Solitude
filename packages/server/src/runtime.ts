import type { ControlInput } from "@solitude/engine/plugin";
import type {
  RuntimeWorldSnapshot,
  WorldAndScene,
} from "@solitude/engine/runtime";
import {
  captureRuntimeSnapshotInto,
  createRuntimeSnapshot,
} from "@solitude/engine/runtime";
import type { EntityId } from "@solitude/engine/world";
import { createSolitudeHeadlessLoop } from "solitude/headless";

export type SolitudeServerControlInputs = ReadonlyMap<
  EntityId,
  Partial<ControlInput>
>;

export interface SolitudeServerGame {
  readonly snapshot: RuntimeWorldSnapshot;
  readonly worldAndScene: WorldAndScene;
  step: (
    dtMillis: number,
    controlInputsByEntityId: SolitudeServerControlInputs,
  ) => RuntimeWorldSnapshot;
}

export function createSolitudeServerGame(): SolitudeServerGame {
  const { loop } = createSolitudeHeadlessLoop();
  const snapshot = createRuntimeSnapshot();
  captureRuntimeSnapshotInto(snapshot, loop.worldAndScene.world);

  return {
    snapshot,
    worldAndScene: loop.worldAndScene,
    step: (dtMillis, controlInputsByEntityId) => {
      loop.stepWithEntityInputs(dtMillis, controlInputsByEntityId);
      return captureRuntimeSnapshotInto(snapshot, loop.worldAndScene.world);
    },
  };
}
