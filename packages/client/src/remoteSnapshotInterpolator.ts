import { localFrame, mat3, vec3, type LocalFrame } from "@solitude/engine/math";
import type {
  RuntimeEntitySnapshot,
  RuntimeWorldSnapshot,
} from "@solitude/engine/runtime";

export interface TimedRuntimeWorldSnapshot {
  receivedAtMillis: number;
  simulationTimeMillis: number;
  snapshot: RuntimeWorldSnapshot;
  tick: number;
}

export interface RuntimeSnapshotInterpolationBufferOptions {
  capacity?: number;
  delayMillis?: number;
  maxExtrapolationMillis?: number;
}

export interface RuntimeSnapshotInterpolationBuffer {
  readonly latestTick: number;
  readonly metrics: RuntimeSnapshotInterpolationMetrics;
  push: (
    snapshot: RuntimeWorldSnapshot,
    tick: number,
    simulationTimeMillis: number,
    receivedAtMillis: number,
  ) => void;
  sample: (
    latestSimulationTimeMillis: number,
    latestReceivedAtMillis: number,
    nowMillis: number,
  ) => RuntimeWorldSnapshot | null;
}

export type RuntimeSnapshotInterpolationSampleMode =
  | "clamped"
  | "empty"
  | "extrapolated"
  | "interpolated"
  | "underrun";

export interface RuntimeSnapshotInterpolationMetrics {
  averageInterArrivalMillis: number;
  clampedSampleCount: number;
  droppedSnapshotCount: number;
  extrapolatedSampleCount: number;
  interpolatedSampleCount: number;
  lastInterArrivalMillis: number;
  lastRenderDelayMillis: number;
  latestSampleMode: RuntimeSnapshotInterpolationSampleMode;
  maxInterArrivalMillis: number;
  maxRenderDelayMillis: number;
  sampleCount: number;
  snapshotCount: number;
  underrunSampleCount: number;
}

const defaultCapacity = 8;
const defaultInterpolationDelayMillis = 75;
const defaultMaxExtrapolationMillis = 50;

export function createRuntimeSnapshotInterpolationBuffer(
  options: RuntimeSnapshotInterpolationBufferOptions = {},
): RuntimeSnapshotInterpolationBuffer {
  const capacity = Math.max(2, Math.floor(options.capacity ?? defaultCapacity));
  const delayMillis = options.delayMillis ?? defaultInterpolationDelayMillis;
  const maxExtrapolationMillis =
    options.maxExtrapolationMillis ?? defaultMaxExtrapolationMillis;
  const snapshots: TimedRuntimeWorldSnapshot[] = [];
  const interpolated = createRuntimeSnapshotStorage();
  const metrics = createRuntimeSnapshotInterpolationMetrics();
  let latestTick = 0;
  let interArrivalTotalMillis = 0;

  return {
    get latestTick() {
      return latestTick;
    },
    metrics,
    push: (snapshot, tick, simulationTimeMillis, receivedAtMillis) => {
      if (tick <= latestTick) {
        metrics.droppedSnapshotCount++;
        return;
      }
      const previousLatest = snapshots[snapshots.length - 1];
      if (previousLatest) {
        const interArrivalMillis = Math.max(
          0,
          receivedAtMillis - previousLatest.receivedAtMillis,
        );
        metrics.lastInterArrivalMillis = interArrivalMillis;
        metrics.maxInterArrivalMillis = Math.max(
          metrics.maxInterArrivalMillis,
          interArrivalMillis,
        );
        interArrivalTotalMillis += interArrivalMillis;
        metrics.averageInterArrivalMillis =
          interArrivalTotalMillis / metrics.snapshotCount;
      }
      latestTick = tick;
      metrics.snapshotCount++;
      insertOrdered(snapshots, {
        receivedAtMillis,
        simulationTimeMillis,
        snapshot,
        tick,
      });
      if (snapshots.length > capacity) {
        snapshots.splice(0, snapshots.length - capacity);
      }
    },
    sample: (latestSimulationTimeMillis, latestReceivedAtMillis, nowMillis) => {
      const latest = snapshots[snapshots.length - 1];
      if (!latest) {
        recordSample(metrics, "empty", 0);
        return null;
      }

      const estimatedSimulationTimeMillis =
        latestSimulationTimeMillis +
        Math.max(0, nowMillis - latestReceivedAtMillis);
      const targetMillis = estimatedSimulationTimeMillis - delayMillis;
      const first = snapshots[0];
      if (targetMillis <= first.simulationTimeMillis) {
        recordSample(
          metrics,
          "underrun",
          estimatedSimulationTimeMillis - first.simulationTimeMillis,
        );
        return first.snapshot;
      }

      if (targetMillis >= latest.simulationTimeMillis) {
        if (
          targetMillis >
          latest.simulationTimeMillis + maxExtrapolationMillis
        ) {
          recordSample(
            metrics,
            "clamped",
            estimatedSimulationTimeMillis - latest.simulationTimeMillis,
          );
          return latest.snapshot;
        }
        const previous = snapshots[snapshots.length - 2];
        if (!previous) {
          recordSample(
            metrics,
            "clamped",
            estimatedSimulationTimeMillis - latest.simulationTimeMillis,
          );
          return latest.snapshot;
        }
        recordSample(metrics, "extrapolated", delayMillis);
        return interpolateRuntimeWorldSnapshotInto(
          interpolated,
          previous.snapshot,
          latest.snapshot,
          (targetMillis - previous.simulationTimeMillis) /
            (latest.simulationTimeMillis - previous.simulationTimeMillis),
        );
      }

      const nextIndex = findNextSnapshotIndex(snapshots, targetMillis);
      const previous = snapshots[nextIndex - 1];
      const next = snapshots[nextIndex];
      if (!previous || !next) {
        recordSample(
          metrics,
          "clamped",
          estimatedSimulationTimeMillis - latest.simulationTimeMillis,
        );
        return latest.snapshot;
      }

      const alpha =
        (targetMillis - previous.simulationTimeMillis) /
        (next.simulationTimeMillis - previous.simulationTimeMillis);
      recordSample(metrics, "interpolated", delayMillis);
      return interpolateRuntimeWorldSnapshotInto(
        interpolated,
        previous.snapshot,
        next.snapshot,
        alpha,
      );
    },
  };
}

export function copyRuntimeSnapshotInterpolationMetrics(
  metrics: RuntimeSnapshotInterpolationMetrics,
): RuntimeSnapshotInterpolationMetrics {
  return { ...metrics };
}

function createRuntimeSnapshotInterpolationMetrics(): RuntimeSnapshotInterpolationMetrics {
  return {
    averageInterArrivalMillis: 0,
    clampedSampleCount: 0,
    droppedSnapshotCount: 0,
    extrapolatedSampleCount: 0,
    interpolatedSampleCount: 0,
    lastInterArrivalMillis: 0,
    lastRenderDelayMillis: 0,
    latestSampleMode: "empty",
    maxInterArrivalMillis: 0,
    maxRenderDelayMillis: 0,
    sampleCount: 0,
    snapshotCount: 0,
    underrunSampleCount: 0,
  };
}

function recordSample(
  metrics: RuntimeSnapshotInterpolationMetrics,
  mode: RuntimeSnapshotInterpolationSampleMode,
  renderDelayMillis: number,
): void {
  metrics.sampleCount++;
  metrics.latestSampleMode = mode;
  metrics.lastRenderDelayMillis = Math.max(0, renderDelayMillis);
  metrics.maxRenderDelayMillis = Math.max(
    metrics.maxRenderDelayMillis,
    metrics.lastRenderDelayMillis,
  );
  switch (mode) {
    case "clamped":
      metrics.clampedSampleCount++;
      return;
    case "extrapolated":
      metrics.extrapolatedSampleCount++;
      return;
    case "interpolated":
      metrics.interpolatedSampleCount++;
      return;
    case "underrun":
      metrics.underrunSampleCount++;
      return;
    case "empty":
      return;
  }
}

function insertOrdered(
  snapshots: TimedRuntimeWorldSnapshot[],
  snapshot: TimedRuntimeWorldSnapshot,
): void {
  let index = snapshots.length;
  while (
    index > 0 &&
    snapshots[index - 1].simulationTimeMillis > snapshot.simulationTimeMillis
  ) {
    index--;
  }
  snapshots.splice(index, 0, snapshot);
}

function findNextSnapshotIndex(
  snapshots: readonly TimedRuntimeWorldSnapshot[],
  simulationTimeMillis: number,
): number {
  for (let i = 0; i < snapshots.length; i++) {
    if (snapshots[i].simulationTimeMillis >= simulationTimeMillis) return i;
  }
  return snapshots.length - 1;
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

export function copyRuntimeEntitySnapshotInto(
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
