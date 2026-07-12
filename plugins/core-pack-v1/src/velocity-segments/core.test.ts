import {
  type ExternalControlledBody,
  type ExternalSegmentProviderParams,
  type ExternalWorldSegment,
  type ExternalWorldSegmentSink,
  vec3,
} from "@solitude/plugin-api";
import { describe, expect, it } from "vitest";
import { createSegmentsPlugin } from "./core";

describe("velocity segments", () => {
  it("draws forward and backward segments along velocity", () => {
    const body = createBody(0, 10, 0);
    const sink = createSegmentSink();

    createSegmentsPlugin().appendSegments!(sink, createParams(body));

    expect(sink.items).toHaveLength(2);
    expect(sink.items[0].start).toEqual(vec3.create(0, 7, 0));
    expect(sink.items[0].end).toEqual(vec3.create(0, 500_000, 0));
    expect(sink.items[1].start).toEqual(vec3.create(0, -7, 0));
    expect(sink.items[1].end).toEqual(vec3.create(0, -500_000, 0));
  });

  it("does not draw segments for a stationary body", () => {
    const sink = createSegmentSink();

    createSegmentsPlugin().appendSegments!(
      sink,
      createParams(createBody(0, 0, 0)),
    );

    expect(sink.items).toHaveLength(0);
  });
});

function createBody(x: number, y: number, z: number): ExternalControlledBody {
  return {
    frame: { forward: vec3.create(0, 1, 0) },
    id: "ship:test",
    position: vec3.zero(),
    velocity: vec3.create(x, y, z),
  };
}

function createParams(
  body: ExternalControlledBody,
): ExternalSegmentProviderParams {
  return {
    mainFocus: { controlledBody: body, entityId: body.id },
    world: { collisionSpheres: [] },
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
