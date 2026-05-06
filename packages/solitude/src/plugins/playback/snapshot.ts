import type {
  ControlledBody,
  EntityMotionState,
  World,
} from "@solitude/engine/domain/domainPorts";
import type { LocalFrame } from "@solitude/engine/domain/localFrame";
import type { Mat3 } from "@solitude/engine/domain/mat3";
import { getDominantBodyPrimary } from "@solitude/engine/domain/orbit";
import type { Vec3 } from "@solitude/engine/domain/vec3";
import { vec3 } from "@solitude/engine/domain/vec3";
import type {
  PlaybackEntitySnapshot,
  PlaybackScenarioId,
  PlaybackSnapshot,
} from "./types";

export function capturePlaybackSnapshot(
  world: World,
  controlledBody: ControlledBody,
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
    entities: world.entityStates.map(captureEntity),
  };
}

export function applyPlaybackSnapshot(
  snapshot: PlaybackSnapshot,
  world: World,
): boolean {
  return applyEntitySnapshots(snapshot.entities, world);
}

function captureEntity(entity: EntityMotionState): PlaybackEntitySnapshot {
  const snapshot: PlaybackEntitySnapshot = {
    id: entity.id,
    position: cloneVec3(entity.position),
    velocity: cloneVec3(entity.velocity),
    orientation: cloneMat3(entity.orientation),
  };
  if (hasFrame(entity)) snapshot.frame = cloneFrame(entity.frame);
  if (hasAngularVelocity(entity)) {
    snapshot.angularVelocity = { ...entity.angularVelocity };
  }
  return snapshot;
}

function applyEntitySnapshots(
  snapshots: PlaybackEntitySnapshot[],
  world: World,
): boolean {
  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i];
    const entity = findById(world.entityStates, snapshot.id);
    if (!entity) return false;
    copyVec3(entity.position, snapshot.position);
    copyVec3(entity.velocity, snapshot.velocity);
    copyMat3(entity.orientation, snapshot.orientation);
    if (snapshot.frame && hasFrame(entity)) {
      copyFrame(entity.frame, snapshot.frame);
    }
    if (snapshot.angularVelocity && hasAngularVelocity(entity)) {
      entity.angularVelocity.roll = snapshot.angularVelocity.roll;
      entity.angularVelocity.pitch = snapshot.angularVelocity.pitch;
      entity.angularVelocity.yaw = snapshot.angularVelocity.yaw;
    }
  }
  return true;
}

function findById<T extends { id: string }>(items: T[], id: string): T | null {
  for (let i = 0; i < items.length; i++) {
    if (items[i].id === id) return items[i];
  }
  return null;
}

function hasFrame(entity: EntityMotionState): entity is EntityMotionState & {
  frame: LocalFrame;
} {
  return "frame" in entity;
}

function hasAngularVelocity(
  entity: EntityMotionState,
): entity is EntityMotionState & Pick<ControlledBody, "angularVelocity"> {
  return "angularVelocity" in entity;
}

function cloneVec3(value: Vec3): Vec3 {
  return { x: value.x, y: value.y, z: value.z };
}

function cloneFrame(frame: LocalFrame): LocalFrame {
  return {
    right: cloneVec3(frame.right),
    forward: cloneVec3(frame.forward),
    up: cloneVec3(frame.up),
  };
}

function cloneMat3(value: Mat3): Mat3 {
  return [
    [value[0][0], value[0][1], value[0][2]],
    [value[1][0], value[1][1], value[1][2]],
    [value[2][0], value[2][1], value[2][2]],
  ];
}

function copyVec3(into: Vec3, value: Vec3): void {
  vec3.copyInto(into, value);
}

function copyFrame(into: LocalFrame, value: LocalFrame): void {
  copyVec3(into.right, value.right);
  copyVec3(into.forward, value.forward);
  copyVec3(into.up, value.up);
}

function copyMat3(into: Mat3, value: Mat3): void {
  into[0][0] = value[0][0];
  into[0][1] = value[0][1];
  into[0][2] = value[0][2];
  into[1][0] = value[1][0];
  into[1][1] = value[1][1];
  into[1][2] = value[1][2];
  into[2][0] = value[2][0];
  into[2][1] = value[2][1];
  into[2][2] = value[2][2];
}
