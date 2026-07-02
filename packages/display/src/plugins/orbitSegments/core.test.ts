import {
  circularSpeedAtRadius,
  localFrame,
  mat3,
  vec3,
} from "@solitude/engine/math";
import type {
  SegmentProviderParams,
  WorldSegment,
} from "@solitude/engine/plugin";
import { createWorldSegmentBuffer } from "@solitude/engine/plugin";
import type {
  ControlledBody,
  EntityCollisionSphere,
  EntityGravityMass,
  World,
} from "@solitude/engine/world";
import { describe, expect, it } from "vitest";
import { createOrbitSegmentsController } from "./core";

describe("orbit segments", () => {
  it("toggles an analytic circular orbit around the dominant body", () => {
    const radius = 10_000;
    const fixture = createFixture({
      shipPosition: vec3.create(radius, 0, 0),
      shipVelocity: vec3.create(0, circularSpeedAtRadius(5.972e24, radius), 0),
    });
    const controller = createOrbitSegmentsController();

    expect(appendSegments(controller, fixture.params)).toHaveLength(0);
    controller.requestToggle();
    const segments = appendSegments(controller, fixture.params);

    expect(segments).toHaveLength(192);
    expect(segments[0].start.x).toBeCloseTo(radius);
    expect(segments[0].start.y).toBeCloseTo(0);
    expect(segments[48].start.x).toBeCloseTo(0, 6);
    expect(segments[48].start.y).toBeCloseTo(radius, 6);
    expect(segments[96].start.x).toBeCloseTo(-radius);
    expect(segments[96].start.y).toBeCloseTo(0, 6);
  });

  it("does not draw unbound escape trajectories", () => {
    const fixture = createFixture({
      shipPosition: vec3.create(10_000, 0, 0),
      shipVelocity: vec3.create(0, 1_000_000, 0),
    });
    const controller = createOrbitSegmentsController();

    controller.requestToggle();

    expect(appendSegments(controller, fixture.params)).toHaveLength(0);
  });
});

function appendSegments(
  controller: ReturnType<typeof createOrbitSegmentsController>,
  params: SegmentProviderParams,
): WorldSegment[] {
  const segments = createWorldSegmentBuffer();
  controller.segments.appendSegments!(segments, params);
  return segments.items.slice(0, segments.count);
}

function createFixture(options: {
  shipPosition: ReturnType<typeof vec3.create>;
  shipVelocity: ReturnType<typeof vec3.create>;
}): {
  body: ControlledBody;
  params: SegmentProviderParams;
} {
  const frame = localFrame.clone({
    forward: vec3.create(0, 1, 0),
    right: vec3.create(1, 0, 0),
    up: vec3.create(0, 0, 1),
  });
  const body: ControlledBody = {
    angularVelocity: { pitch: 0, roll: 0, yaw: 0 },
    frame,
    id: "ship:test",
    orientation: localFrame.intoMat3(mat3.zero(), frame),
    position: options.shipPosition,
    velocity: options.shipVelocity,
  };
  const planetState = {
    id: "planet:test",
    orientation: mat3.copy(mat3.identity, mat3.zero()),
    position: vec3.zero(),
    velocity: vec3.zero(),
  };
  const sphere: EntityCollisionSphere = {
    id: planetState.id,
    radius: 1_000,
    state: planetState,
  };
  const mass: EntityGravityMass = {
    density: 1,
    id: planetState.id,
    mass: 5.972e24,
    state: planetState,
  };
  const world: World = {
    axialSpins: [],
    collisionSpheres: [sphere],
    controllableBodies: [body],
    entities: [{ id: body.id }, { id: planetState.id }],
    entityIndex: new Map(),
    entityStates: [body, planetState],
    gravityMasses: [mass],
    lightEmitters: [],
  };
  return {
    body,
    params: {
      config: {} as SegmentProviderParams["config"],
      mainFocus: { controlledBody: body, entityId: body.id },
      scene: { lights: [], objects: [] },
      viewId: "main",
      world,
    },
  };
}
