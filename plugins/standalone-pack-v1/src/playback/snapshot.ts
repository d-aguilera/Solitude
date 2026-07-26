import type { ExternalRuntimeSnapshotService } from "@solitude/plugin-api/snapshots";
import {
  getDominantBodyPrimary,
  type ExternalControlledBody,
  type ExternalWorld,
} from "@solitude/plugin-api/world";
import type { PlaybackScenarioId, PlaybackSnapshot } from "./types";

export function capturePlaybackSnapshot(
  snapshots: ExternalRuntimeSnapshotService,
  world: ExternalWorld,
  controlledBody: ExternalControlledBody,
  label: PlaybackScenarioId,
  capturedSimTimeMillis: number,
): PlaybackSnapshot {
  const primary = getDominantBodyPrimary(world, controlledBody.position);
  return {
    metadata: {
      label,
      capturedSimTimeMillis,
      dominantBodyId: primary?.id ?? null,
      focusEntityId: controlledBody.id,
    },
    entities: snapshots.capture(world).entities,
  };
}

export function applyPlaybackSnapshot(
  snapshots: ExternalRuntimeSnapshotService,
  snapshot: PlaybackSnapshot,
  world: ExternalWorld,
): boolean {
  return snapshots.apply({ entities: snapshot.entities }, world);
}
