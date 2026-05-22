import type {
  AngularVelocity,
  ControlledBody,
  EntityId,
  EntityMotionState,
  World,
} from "../domain/domainPorts";
import { localFrame, type LocalFrame } from "../domain/localFrame";
import { mat3, type Mat3 } from "../domain/mat3";
import { vec3, type Vec3 } from "../domain/vec3";

export interface RuntimeWorldSnapshot {
  entities: RuntimeEntitySnapshot[];
}

export interface RuntimeEntitySnapshot {
  id: string;
  position: Vec3;
  velocity: Vec3;
  orientation: Mat3;
  angularVelocity?: AngularVelocity;
  frame?: LocalFrame;
}

export interface RuntimeSnapshotApplyWorkspace {
  entityStatesById: Map<EntityId, EntityMotionState>;
}

export function captureRuntimeSnapshot(world: World): RuntimeWorldSnapshot {
  return captureRuntimeSnapshotInto(createRuntimeSnapshot(), world);
}

export function createRuntimeSnapshot(): RuntimeWorldSnapshot {
  return { entities: [] };
}

export function captureRuntimeSnapshotInto(
  into: RuntimeWorldSnapshot,
  world: World,
): RuntimeWorldSnapshot {
  const entities = into.entities;
  const states = world.entityStates;
  entities.length = states.length;
  for (let i = 0; i < states.length; i++) {
    entities[i] = captureRuntimeEntitySnapshotInto(
      entities[i] ?? createRuntimeEntitySnapshot(),
      states[i],
    );
  }
  return into;
}

export function applyRuntimeSnapshot(
  snapshot: RuntimeWorldSnapshot,
  world: World,
): boolean {
  return applyRuntimeSnapshotWithWorkspace(
    snapshot,
    createRuntimeSnapshotApplyWorkspace(world),
  );
}

export function captureRuntimeEntitySnapshot(
  entity: EntityMotionState,
): RuntimeEntitySnapshot {
  return captureRuntimeEntitySnapshotInto(
    createRuntimeEntitySnapshot(),
    entity,
  );
}

export function createRuntimeEntitySnapshot(): RuntimeEntitySnapshot {
  return {
    id: "",
    position: vec3.zero(),
    velocity: vec3.zero(),
    orientation: mat3.zero(),
  };
}

export function captureRuntimeEntitySnapshotInto(
  into: RuntimeEntitySnapshot,
  entity: EntityMotionState,
): RuntimeEntitySnapshot {
  into.id = entity.id;
  vec3.copyInto(into.position, entity.position);
  vec3.copyInto(into.velocity, entity.velocity);
  mat3.copy(entity.orientation, into.orientation);
  if (hasFrame(entity)) {
    into.frame = into.frame ?? localFrame.zero();
    localFrame.copyInto(into.frame, entity.frame);
  } else {
    into.frame = undefined;
  }
  if (hasAngularVelocity(entity)) {
    into.angularVelocity = copyAngularVelocity(
      into.angularVelocity ?? createAngularVelocity(),
      entity.angularVelocity,
    );
  } else {
    into.angularVelocity = undefined;
  }
  return into;
}

export function applyRuntimeEntitySnapshots(
  snapshots: readonly RuntimeEntitySnapshot[],
  world: World,
): boolean {
  return applyRuntimeEntitySnapshotsWithWorkspace(
    snapshots,
    createRuntimeSnapshotApplyWorkspace(world),
  );
}

export function createRuntimeSnapshotApplyWorkspace(
  world: World,
): RuntimeSnapshotApplyWorkspace {
  return refreshRuntimeSnapshotApplyWorkspace(
    { entityStatesById: new Map() },
    world,
  );
}

export function refreshRuntimeSnapshotApplyWorkspace(
  workspace: RuntimeSnapshotApplyWorkspace,
  world: World,
): RuntimeSnapshotApplyWorkspace {
  const entityStatesById = workspace.entityStatesById;
  entityStatesById.clear();
  const states = world.entityStates;
  for (let i = 0; i < states.length; i++) {
    const state = states[i];
    entityStatesById.set(state.id, state);
  }
  return workspace;
}

export function applyRuntimeSnapshotWithWorkspace(
  snapshot: RuntimeWorldSnapshot,
  workspace: RuntimeSnapshotApplyWorkspace,
): boolean {
  return applyRuntimeEntitySnapshotsWithWorkspace(snapshot.entities, workspace);
}

export function applyRuntimeEntitySnapshotsWithWorkspace(
  snapshots: readonly RuntimeEntitySnapshot[],
  workspace: RuntimeSnapshotApplyWorkspace,
): boolean {
  const entityStatesById = workspace.entityStatesById;
  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i];
    const entity = entityStatesById.get(snapshot.id);
    if (!entity) return false;
    vec3.copyInto(entity.position, snapshot.position);
    vec3.copyInto(entity.velocity, snapshot.velocity);
    mat3.copy(snapshot.orientation, entity.orientation);
    if (snapshot.frame && hasFrame(entity)) {
      localFrame.copyInto(entity.frame, snapshot.frame);
    }
    if (snapshot.angularVelocity && hasAngularVelocity(entity)) {
      entity.angularVelocity.roll = snapshot.angularVelocity.roll;
      entity.angularVelocity.pitch = snapshot.angularVelocity.pitch;
      entity.angularVelocity.yaw = snapshot.angularVelocity.yaw;
    }
  }
  return true;
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

function createAngularVelocity(): AngularVelocity {
  return { roll: 0, pitch: 0, yaw: 0 };
}

function copyAngularVelocity(
  into: AngularVelocity,
  value: AngularVelocity,
): AngularVelocity {
  into.roll = value.roll;
  into.pitch = value.pitch;
  into.yaw = value.yaw;
  return into;
}
