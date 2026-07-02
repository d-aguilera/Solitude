import { localFrame, mat3, vec3 } from "@solitude/engine/math";
import type {
  SegmentProviderParams,
  WorldMarker,
  WorldSegment,
} from "@solitude/engine/plugin";
import {
  createWorldMarkerBuffer,
  createWorldSegmentBuffer,
} from "@solitude/engine/plugin";
import type {
  ControlledBody,
  EntityCollisionSphere,
  World,
} from "@solitude/engine/world";
import { describe, expect, it } from "vitest";
import { createTargetingLaserController } from "./core";

describe("targeting laser", () => {
  it("terminates on a locked target and emits an impact dot", () => {
    const fixture = createFixture(createSphere("planet", 0, 1_000, 100));
    const controller = createTargetingLaserController();

    const { markers, segments } = activate(controller, fixture.params);

    expect(segments).toHaveLength(1);
    expect(segments[0].end).toEqual(vec3.create(0, 900, 0));
    expect(markers).toHaveLength(1);
    expect(markers[0].shape).toBe("dot");
    expect(markers[0].position).toEqual(vec3.create(0, 900, 0));
  });

  it("shows the target-plane miss point and surface connector", () => {
    const fixture = createFixture(createSphere("planet", 200, 1_000, 50));
    const controller = createTargetingLaserController();

    const { markers, segments } = activate(controller, fixture.params);

    expect(segments).toHaveLength(2);
    expect(segments[0].end).toEqual(vec3.create(0, 1_000, 0));
    expect(segments[1].start).toEqual(vec3.create(0, 1_000, 0));
    expect(segments[1].end.x).toBeCloseTo(150);
    expect(markers.map((marker) => marker.shape)).toEqual(["cross"]);
  });

  it("keeps the acquired target locked while attitude changes", () => {
    const target = createSphere("planet", 150, 1_000, 50);
    const other = createSphere("other", -150, 1_000, 50);
    const fixture = createFixture(target, other);
    const controller = createTargetingLaserController();
    activate(controller, fixture.params);

    fixture.body.frame.forward.x = -0.15;
    fixture.body.frame.forward.y = Math.sqrt(1 - 0.15 * 0.15);
    const segmentBuffer = createWorldSegmentBuffer();
    const markerBuffer = createWorldMarkerBuffer();
    controller.segments.appendSegments!(segmentBuffer, fixture.params);
    controller.markers.appendMarkers!(markerBuffer, fixture.params);

    const segments = segmentBuffer.items.slice(0, segmentBuffer.count);
    const markers = markerBuffer.items.slice(0, markerBuffer.count);
    expect(segments).toHaveLength(1);
    expect(markers.map((marker) => marker.shape)).toEqual(["dot", "ring"]);
  });

  it("marks an obstruction without replacing the locked target", () => {
    const target = createSphere("planet", 150, 1_000, 50);
    const obstruction = createSphere("moon", -500, 500, 25);
    const fixture = createFixture(target, obstruction);
    const controller = createTargetingLaserController();
    activate(controller, fixture.params);

    obstruction.state.position.x = 0;
    const segmentBuffer = createWorldSegmentBuffer();
    const markerBuffer = createWorldMarkerBuffer();
    controller.segments.appendSegments!(segmentBuffer, fixture.params);
    controller.markers.appendMarkers!(markerBuffer, fixture.params);
    const segments = segmentBuffer.items.slice(0, segmentBuffer.count);
    const markers = markerBuffer.items.slice(0, markerBuffer.count);

    expect(segments[0].end.y).toBe(475);
    expect(markers.map((marker) => marker.shape)).toEqual(["dot", "ring"]);
    expect(markers[1].position).toEqual(target.state.position);
  });

  it("toggles independently for each focused ship", () => {
    const fixture = createFixture(createSphere("planet", 0, 1_000, 100));
    const controller = createTargetingLaserController();
    expect(activate(controller, fixture.params).segments).toHaveLength(1);

    controller.requestToggle();
    const segments = createWorldSegmentBuffer();
    controller.segments.appendSegments!(segments, fixture.params);
    expect(segments.count).toBe(0);
  });
});

function activate(
  controller: ReturnType<typeof createTargetingLaserController>,
  params: SegmentProviderParams,
): { markers: WorldMarker[]; segments: WorldSegment[] } {
  controller.requestToggle();
  const segmentBuffer = createWorldSegmentBuffer();
  const markerBuffer = createWorldMarkerBuffer();
  controller.segments.appendSegments!(segmentBuffer, params);
  controller.markers.appendMarkers!(markerBuffer, params);
  return {
    markers: markerBuffer.items.slice(0, markerBuffer.count),
    segments: segmentBuffer.items.slice(0, segmentBuffer.count),
  };
}

function createFixture(...spheres: EntityCollisionSphere[]): {
  body: ControlledBody;
  params: SegmentProviderParams;
} {
  const frame = localFrame.clone({
    right: vec3.create(1, 0, 0),
    forward: vec3.create(0, 1, 0),
    up: vec3.create(0, 0, 1),
  });
  const body: ControlledBody = {
    angularVelocity: { pitch: 0, roll: 0, yaw: 0 },
    frame,
    id: "ship:test",
    orientation: localFrame.intoMat3(mat3.zero(), frame),
    position: vec3.zero(),
    velocity: vec3.zero(),
  };
  const world: World = {
    axialSpins: [],
    collisionSpheres: spheres,
    controllableBodies: [body],
    entities: [{ id: body.id }, ...spheres.map(({ id }) => ({ id }))],
    entityIndex: new Map(),
    entityStates: [body, ...spheres.map(({ state }) => state)],
    gravityMasses: [],
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

function createSphere(
  id: string,
  x: number,
  y: number,
  radius: number,
): EntityCollisionSphere {
  return {
    id,
    radius,
    state: {
      id,
      orientation: mat3.copy(mat3.identity, mat3.zero()),
      position: vec3.create(x, y, 0),
      velocity: vec3.zero(),
    },
  };
}
