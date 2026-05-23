import type { RuntimeWorldSnapshot } from "@solitude/engine/runtime";
import {
  applyRuntimeSnapshotWithWorkspace,
  createRuntimeSnapshotApplyWorkspace,
  refreshRuntimeSnapshotApplyWorkspace,
  type RuntimeSnapshotApplyWorkspace,
} from "@solitude/engine/runtime";
import {
  createWorld,
  type World,
  type WorldConfigBase,
  type WorldSetup,
} from "@solitude/engine/world";

export interface RemoteWorldMirror {
  readonly applyWorkspace: RuntimeSnapshotApplyWorkspace;
  readonly world: World;
  readonly worldSetup: WorldSetup;
  applySnapshot: (snapshot: RuntimeWorldSnapshot) => boolean;
  refreshApplyWorkspace: () => void;
}

export function createRemoteWorldMirror(
  config: WorldConfigBase,
): RemoteWorldMirror {
  const worldSetup = createWorld(config);
  const applyWorkspace = createRuntimeSnapshotApplyWorkspace(worldSetup.world);

  return {
    applyWorkspace,
    world: worldSetup.world,
    worldSetup,
    applySnapshot: (snapshot) =>
      applyRuntimeSnapshotWithWorkspace(snapshot, applyWorkspace),
    refreshApplyWorkspace: () => {
      refreshRuntimeSnapshotApplyWorkspace(applyWorkspace, worldSetup.world);
    },
  };
}
