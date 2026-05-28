import { localFrame, mat3, vec3, type LocalFrame } from "@solitude/engine/math";
import type {
  RuntimeEntitySnapshot,
  RuntimeWorldSnapshot,
} from "@solitude/engine/runtime";

export interface TimedRuntimeWorldSnapshot {
  receivedAtMillis: number;
  snapshot: RuntimeWorldSnapshot;
  tick: number;
}

export interface RuntimeSnapshotInterpolationBufferOptions {
  delayMillis?: number;
}

export interface RuntimeSnapshotInterpolationBuffer {
  readonly latestTick: number;
  push: (
    snapshot: RuntimeWorldSnapshot,
    tick: number,
    receivedAtMillis: number,
  ) => void;
  sample: (nowMillis: number) => RuntimeWorldSnapshot | null;
}

const defaultInterpolationDelayMillis = 300;

export function createRuntimeSnapshotInterpolationBuffer(
  options: RuntimeSnapshotInterpolationBufferOptions = {},
): RuntimeSnapshotInterpolationBuffer {
  const delayMillis = options.delayMillis ?? defaultInterpolationDelayMillis;
  let previous: TimedRuntimeWorldSnapshot | null = null;
  let next: TimedRuntimeWorldSnapshot | null = null;
  const interpolated = createRuntimeSnapshotStorage();
  let latestTick = 0;

  return {
    get latestTick() {
      return latestTick;
    },
    push: (snapshot, tick, receivedAtMillis) => {
      latestTick = tick;
      previous = next;
      next = { receivedAtMillis, snapshot, tick };
    },
    sample: (nowMillis) => {
      if (!next) return null;
      if (!previous || previous.receivedAtMillis >= next.receivedAtMillis) {
        return next.snapshot;
      }

      const targetMillis = nowMillis - delayMillis;
      if (targetMillis <= previous.receivedAtMillis) return previous.snapshot;
      if (targetMillis >= next.receivedAtMillis) return next.snapshot;

      const alpha =
        (targetMillis - previous.receivedAtMillis) /
        (next.receivedAtMillis - previous.receivedAtMillis);
      return interpolateRuntimeWorldSnapshotInto(
        interpolated,
        previous.snapshot,
        next.snapshot,
        alpha,
      );
    },
  };
}

export function interpolateRuntimeWorldSnapshotInto(
  into: RuntimeWorldSnapshot,
  from: RuntimeWorldSnapshot,
  to: RuntimeWorldSnapshot,
  alpha: number,
): RuntimeWorldSnapshot {
  const t = clamp01(alpha);
  const entities = into.entities;
  const fromEntities = from.entities;
  const toEntities = to.entities;
  entities.length = toEntities.length;
  for (let i = 0; i < toEntities.length; i++) {
    entities[i] = interpolateRuntimeEntitySnapshotInto(
      entities[i] ?? createRuntimeEntitySnapshotStorage(),
      fromEntities[i],
      toEntities[i],
      t,
    );
  }
  return into;
}

function interpolateRuntimeEntitySnapshotInto(
  into: RuntimeEntitySnapshot,
  from: RuntimeEntitySnapshot | undefined,
  to: RuntimeEntitySnapshot,
  alpha: number,
): RuntimeEntitySnapshot {
  if (!from || from.id !== to.id) {
    copyRuntimeEntitySnapshotInto(into, to);
    return into;
  }

  into.id = to.id;
  vec3.lerpInto(into.position, from.position, to.position, alpha);
  vec3.lerpInto(into.velocity, from.velocity, to.velocity, alpha);

  if (from.frame && to.frame) {
    into.frame ??= localFrame.zero();
    lerpLocalFrameInto(into.frame, from.frame, to.frame, alpha);
    localFrame.intoMat3(into.orientation, into.frame);
  } else {
    into.frame = undefined;
    lerpMat3Into(into.orientation, from.orientation, to.orientation, alpha);
  }

  if (from.angularVelocity && to.angularVelocity) {
    into.angularVelocity ??= { pitch: 0, roll: 0, yaw: 0 };
    into.angularVelocity.pitch = lerpNumber(
      from.angularVelocity.pitch,
      to.angularVelocity.pitch,
      alpha,
    );
    into.angularVelocity.roll = lerpNumber(
      from.angularVelocity.roll,
      to.angularVelocity.roll,
      alpha,
    );
    into.angularVelocity.yaw = lerpNumber(
      from.angularVelocity.yaw,
      to.angularVelocity.yaw,
      alpha,
    );
  } else {
    into.angularVelocity = undefined;
  }

  return into;
}

function createRuntimeSnapshotStorage(): RuntimeWorldSnapshot {
  return { entities: [] };
}

function createRuntimeEntitySnapshotStorage(): RuntimeEntitySnapshot {
  return {
    id: "",
    orientation: mat3.zero(),
    position: vec3.zero(),
    velocity: vec3.zero(),
  };
}

function copyRuntimeEntitySnapshotInto(
  into: RuntimeEntitySnapshot,
  source: RuntimeEntitySnapshot,
): RuntimeEntitySnapshot {
  into.id = source.id;
  vec3.copyInto(into.position, source.position);
  vec3.copyInto(into.velocity, source.velocity);
  mat3.copy(source.orientation, into.orientation);
  if (source.frame) {
    into.frame ??= localFrame.zero();
    localFrame.copyInto(into.frame, source.frame);
  } else {
    into.frame = undefined;
  }
  if (source.angularVelocity) {
    into.angularVelocity ??= { pitch: 0, roll: 0, yaw: 0 };
    into.angularVelocity.pitch = source.angularVelocity.pitch;
    into.angularVelocity.roll = source.angularVelocity.roll;
    into.angularVelocity.yaw = source.angularVelocity.yaw;
  } else {
    into.angularVelocity = undefined;
  }
  return into;
}

function lerpLocalFrameInto(
  into: LocalFrame,
  from: LocalFrame,
  to: LocalFrame,
  alpha: number,
): void {
  vec3.lerpInto(into.right, from.right, to.right, alpha);
  vec3.normalizeInto(into.right);
  vec3.lerpInto(into.forward, from.forward, to.forward, alpha);
  const forwardDotRight = vec3.dot(into.forward, into.right);
  into.forward.x -= into.right.x * forwardDotRight;
  into.forward.y -= into.right.y * forwardDotRight;
  into.forward.z -= into.right.z * forwardDotRight;
  vec3.normalizeInto(into.forward);
  vec3.crossInto(into.up, into.right, into.forward);
  vec3.normalizeInto(into.up);
}

function lerpMat3Into(
  into: RuntimeEntitySnapshot["orientation"],
  from: RuntimeEntitySnapshot["orientation"],
  to: RuntimeEntitySnapshot["orientation"],
  alpha: number,
): void {
  for (let rowIndex = 0; rowIndex < 3; rowIndex++) {
    const intoRow = into[rowIndex];
    const fromRow = from[rowIndex];
    const toRow = to[rowIndex];
    intoRow[0] = lerpNumber(fromRow[0], toRow[0], alpha);
    intoRow[1] = lerpNumber(fromRow[1], toRow[1], alpha);
    intoRow[2] = lerpNumber(fromRow[2], toRow[2], alpha);
  }
}

function lerpNumber(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
