import { getDominantBodyPrimary } from "@solitude/engine/math";
import {
  applyRuntimeSnapshot,
  captureRuntimeSnapshot,
} from "@solitude/engine/runtime";
import type { ControlledBody, World } from "@solitude/engine/world";
import type { PlaybackScenarioId, PlaybackSnapshot } from "./types";

export function capturePlaybackSnapshot(
  world: World,
  controlledBody: ControlledBody,
  label: PlaybackScenarioId,
  capturedSimTimeMillis: number,
): PlaybackSnapshot {
  const primary = getDominantBodyPrimary(world, controlledBody.position);
  const snapshot = captureRuntimeSnapshot(world);
  return {
    metadata: {
      label,
      capturedSimTimeMillis,
      dominantBodyId: primary?.id ?? null,
      focusEntityId: controlledBody.id,
    },
    entities: snapshot.entities,
  };
}

export function applyPlaybackSnapshot(
  snapshot: PlaybackSnapshot,
  world: World,
): boolean {
  return applyRuntimeSnapshot(snapshot, world);
}
