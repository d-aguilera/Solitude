import {
  computeStandardGravitationalParameter,
  type ExternalControlledBody,
  type ExternalSegmentProviderParams,
  type ExternalWorldSegment,
  type ExternalWorldSegmentSink,
  vec3,
} from "@solitude/plugin-api";
import { describe, expect, it } from "vitest";
import { createOrbitSegmentsController } from "./core";

const PLANET_MASS = 5.972e24;

describe("orbit segments", () => {
  it("toggles an analytic circular orbit around the dominant body", () => {
    const radius = 10_000;
    const fixture = createFixture({
      shipPosition: vec3.create(radius, 0, 0),
      shipVelocity: vec3.create(
        0,
        Math.sqrt(computeStandardGravitationalParameter(PLANET_MASS) / radius),
        0,
      ),
    });
    const controller = createOrbitSegmentsController();

    expect(appendSegments(controller, fixture)).toHaveLength(0);
    controller.requestToggle();
    const segments = appendSegments(controller, fixture);

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

    expect(appendSegments(controller, fixture)).toHaveLength(0);
  });
});

function appendSegments(
  controller: ReturnType<typeof createOrbitSegmentsController>,
  params: ExternalSegmentProviderParams,
): ExternalWorldSegment[] {
  const sink = createSegmentSink();
  controller.segments.appendSegments!(sink, params);
  return sink.items;
}

function createFixture(options: {
  shipPosition: ReturnType<typeof vec3.create>;
  shipVelocity: ReturnType<typeof vec3.create>;
}): ExternalSegmentProviderParams {
  const ship: ExternalControlledBody = {
    frame: { forward: vec3.create(0, 1, 0) },
    id: "ship:test",
    position: options.shipPosition,
    velocity: options.shipVelocity,
  };
  const planetState = {
    id: "planet:test",
    position: vec3.zero(),
    velocity: vec3.zero(),
  };
  return {
    mainFocus: { controlledBody: ship, entityId: ship.id },
    world: {
      collisionSpheres: [
        { id: planetState.id, radius: 1_000, state: planetState },
      ],
      gravityMasses: [
        {
          id: planetState.id,
          mass: PLANET_MASS,
          state: planetState,
        },
      ],
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
        end: vec3.clone(end),
        lineWidth,
        start: vec3.clone(start),
      };
      items.push(segment);
      return segment;
    },
    reset: () => items.splice(0, items.length),
  };
}
