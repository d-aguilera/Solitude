import { localFrame, mat3, vec3 } from "@solitude/engine/math";
import type { RuntimeWorldSnapshot } from "@solitude/engine/runtime";
import { describe, expect, it } from "vitest";
import {
  copyRuntimeSnapshotInterpolationMetrics,
  createRuntimeSnapshotInterpolationBuffer,
  interpolateRuntimeWorldSnapshotInto,
} from "../remoteSnapshotInterpolator";

describe("remote snapshot interpolation", () => {
  it("samples a delayed position between authoritative snapshots", () => {
    const buffer = createRuntimeSnapshotInterpolationBuffer({
      delayMillis: 50,
    });
    const first = createSnapshot(0, 0);
    const second = createSnapshot(100, 10);

    buffer.push(first, 1, 0, 1000, 1);
    buffer.push(second, 2, 100, 1200, 1);

    const sample = buffer.sample(100, 1200, 1200);

    expect(sample?.entities[0].position.x).toBe(50);
    expect(sample?.entities[0].velocity.y).toBe(5);
  });

  it("samples by simulation time instead of arrival time", () => {
    const buffer = createRuntimeSnapshotInterpolationBuffer({
      delayMillis: 50,
    });
    const first = createSnapshot(0, 0);
    const second = createSnapshot(100, 10);

    buffer.push(first, 1, 0, 1000, 1);
    buffer.push(second, 2, 100, 1400, 1);

    const sample = buffer.sample(100, 1400, 1400);

    expect(sample?.entities[0].position.x).toBe(50);
    expect(sample?.entities[0].velocity.y).toBe(5);
  });

  it("drops stale snapshots", () => {
    const buffer = createRuntimeSnapshotInterpolationBuffer({
      delayMillis: 50,
    });
    const first = createSnapshot(0, 0);
    const second = createSnapshot(100, 10);

    buffer.push(second, 2, 100, 1200, 1);
    buffer.push(first, 1, 0, 1000, 1);

    const sample = buffer.sample(100, 1200, 1300);

    expect(sample?.entities[0].position.x).toBe(100);
  });

  it("records interpolation timing and sample-mode metrics", () => {
    const buffer = createRuntimeSnapshotInterpolationBuffer({
      delayMillis: 50,
      maxExtrapolationMillis: 25,
    });
    const first = createSnapshot(0, 0);
    const second = createSnapshot(100, 10);

    buffer.push(first, 1, 0, 1000, 1);
    buffer.push(second, 2, 100, 1020, 1);
    buffer.push(first, 1, 0, 1010, 1);

    buffer.sample(100, 1020, 1020);
    buffer.sample(100, 1020, 1080);
    buffer.sample(100, 1020, 1200);

    expect(copyRuntimeSnapshotInterpolationMetrics(buffer.metrics)).toEqual({
      averageInterArrivalMillis: 20,
      clampedSampleCount: 1,
      droppedSnapshotCount: 1,
      extrapolatedSampleCount: 1,
      interpolatedSampleCount: 1,
      lastInterArrivalMillis: 20,
      lastRenderDelayMillis: 180,
      latestSampleMode: "clamped",
      maxInterArrivalMillis: 20,
      maxRenderDelayMillis: 180,
      sampleCount: 3,
      simulationMillisPerWallMillis: 1,
      snapshotCount: 2,
      underrunSampleCount: 0,
    });
  });

  it("converts wall-clock interpolation delay into accelerated simulation time", () => {
    const buffer = createRuntimeSnapshotInterpolationBuffer({
      delayMillis: 75,
    });

    buffer.push(createSnapshot(0, 0), 1, 0, 1000, 32);
    buffer.push(createSnapshot(1600, 0), 2, 1600, 1050, 32);
    buffer.push(createSnapshot(3200, 0), 3, 3200, 1100, 32);
    buffer.push(createSnapshot(4800, 0), 4, 4800, 1150, 32);

    const sample = buffer.sample(4800, 1150, 1162.5);

    expect(sample?.entities[0].position.x).toBe(2800);
    expect(buffer.metrics.simulationMillisPerWallMillis).toBe(32);
  });

  it("reuses output storage while preserving endpoint snapshots", () => {
    const into: RuntimeWorldSnapshot = { entities: [] };
    const first = createSnapshot(0, 0);
    const second = createSnapshot(100, 10);

    const sample = interpolateRuntimeWorldSnapshotInto(
      into,
      first,
      second,
      0.25,
    );

    expect(sample).toBe(into);
    expect(sample.entities[0].position.x).toBe(25);
    expect(first.entities[0].position.x).toBe(0);
    expect(second.entities[0].position.x).toBe(100);
    expect(sample.entities[0].frame?.right.x).toBeCloseTo(1);
  });

  it("keeps interpolated local frames orthonormal", () => {
    const into: RuntimeWorldSnapshot = { entities: [] };
    const first = createSnapshot(0, 0);
    const second = createSnapshot(100, 10);
    second.entities[0].frame = {
      forward: vec3.create(1, 0, 0),
      right: vec3.create(0, -1, 0),
      up: vec3.create(0, 0, 1),
    };

    const sample = interpolateRuntimeWorldSnapshotInto(
      into,
      first,
      second,
      0.5,
    );

    const frame = sample.entities[0].frame;
    expect(frame).toBeDefined();
    expect(vec3.length(frame!.right)).toBeCloseTo(1);
    expect(vec3.length(frame!.forward)).toBeCloseTo(1);
    expect(vec3.length(frame!.up)).toBeCloseTo(1);
    expect(vec3.dot(frame!.right, frame!.forward)).toBeCloseTo(0);
    expect(vec3.dot(frame!.right, frame!.up)).toBeCloseTo(0);
    expect(vec3.dot(frame!.forward, frame!.up)).toBeCloseTo(0);
  });
});

function createSnapshot(x: number, velocityY: number): RuntimeWorldSnapshot {
  const frame = {
    forward: vec3.create(0, 1, 0),
    right: vec3.create(1, 0, 0),
    up: vec3.create(0, 0, 1),
  };
  return {
    entities: [
      {
        angularVelocity: { pitch: 0, roll: 0, yaw: velocityY },
        frame,
        id: "ship:test",
        orientation: localFrame.intoMat3(mat3.zero(), frame),
        position: vec3.create(x, 0, 0),
        velocity: vec3.create(0, velocityY, 0),
      },
    ],
  };
}
