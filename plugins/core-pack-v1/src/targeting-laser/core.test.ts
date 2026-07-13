import type { Vec3 } from "@solitude/plugin-api/math";
import { vec3 } from "@solitude/plugin-api/math";
import type {
  ExternalControlledBody,
  ExternalEntityCollisionSphere,
  ExternalSegmentProviderParams,
  ExternalWorldMarker,
  ExternalWorldMarkerSink,
  ExternalWorldSegment,
  ExternalWorldSegmentSink,
} from "@solitude/plugin-api/plugin";
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
    const segments = createSegmentSink();
    const markers = createMarkerSink();
    controller.segments.appendSegments!(segments, fixture.params);
    controller.markers.appendMarkers!(markers, fixture.params);

    expect(segments.items).toHaveLength(1);
    expect(markers.items.map((marker) => marker.shape)).toEqual([
      "dot",
      "ring",
    ]);
  });

  it("marks an obstruction without replacing the locked target", () => {
    const target = createSphere("planet", 150, 1_000, 50);
    const obstruction = createSphere("moon", -500, 500, 25);
    const fixture = createFixture(target, obstruction);
    const controller = createTargetingLaserController();
    activate(controller, fixture.params);

    obstruction.state.position.x = 0;
    const segments = createSegmentSink();
    const markers = createMarkerSink();
    controller.segments.appendSegments!(segments, fixture.params);
    controller.markers.appendMarkers!(markers, fixture.params);

    expect(segments.items[0].end.y).toBe(475);
    expect(markers.items.map((marker) => marker.shape)).toEqual([
      "dot",
      "ring",
    ]);
    expect(markers.items[1].position).toEqual(target.state.position);
  });

  it("toggles independently for each focused ship", () => {
    const fixture = createFixture(createSphere("planet", 0, 1_000, 100));
    const controller = createTargetingLaserController();
    expect(activate(controller, fixture.params).segments).toHaveLength(1);

    controller.requestToggle();
    const segments = createSegmentSink();
    controller.segments.appendSegments!(segments, fixture.params);
    expect(segments.count).toBe(0);
  });
});

function activate(
  controller: ReturnType<typeof createTargetingLaserController>,
  params: ExternalSegmentProviderParams,
): { markers: ExternalWorldMarker[]; segments: ExternalWorldSegment[] } {
  controller.requestToggle();
  const segments = createSegmentSink();
  const markers = createMarkerSink();
  controller.segments.appendSegments!(segments, params);
  controller.markers.appendMarkers!(markers, params);
  return { markers: markers.items, segments: segments.items };
}

function createFixture(...spheres: ExternalEntityCollisionSphere[]): {
  body: ExternalControlledBody;
  params: ExternalSegmentProviderParams;
} {
  const body: ExternalControlledBody = {
    frame: {
      forward: vec3.create(0, 1, 0),
      right: vec3.create(1, 0, 0),
      up: vec3.create(0, 0, 1),
    },
    id: "ship:test",
    position: vec3.zero(),
    velocity: vec3.zero(),
  };
  return {
    body,
    params: {
      mainFocus: { controlledBody: body, entityId: body.id },
      world: {
        collisionSpheres: spheres,
        controllableBodies: [body],
        entityStates: [body, ...spheres.map((sphere) => sphere.state)],
        gravityMasses: [],
      },
    },
  };
}

function createSphere(
  id: string,
  x: number,
  y: number,
  radius: number,
): ExternalEntityCollisionSphere {
  return {
    id,
    radius,
    state: {
      id,
      position: vec3.create(x, y, 0),
      velocity: vec3.zero(),
    },
  };
}

function createSegmentSink(): ExternalWorldSegmentSink & {
  items: ExternalWorldSegment[];
} {
  const items: ExternalWorldSegment[] = [];
  return {
    get count() {
      return items.length;
    },
    items,
    addSegment: (start, end, color, lineWidth) => {
      const segment = {
        color,
        end: copyVec3(end),
        lineWidth,
        start: copyVec3(start),
      };
      items.push(segment);
      return segment;
    },
    reset: () => items.splice(0, items.length),
  };
}

function createMarkerSink(): ExternalWorldMarkerSink & {
  items: ExternalWorldMarker[];
} {
  const items: ExternalWorldMarker[] = [];
  return {
    get count() {
      return items.length;
    },
    items,
    addMarker: (position, color, radius, lineWidth, shape) => {
      const marker = {
        color,
        lineWidth,
        position: copyVec3(position),
        radius,
        shape,
      };
      items.push(marker);
      return marker;
    },
    reset: () => items.splice(0, items.length),
  };
}

function copyVec3(value: Vec3): Vec3 {
  return { x: value.x, y: value.y, z: value.z };
}
