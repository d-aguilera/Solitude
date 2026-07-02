import { describe, expect, it } from "vitest";
import { vec3 } from "../../domain/vec3";
import {
  createWorldMarkerBuffer,
  createWorldSegmentBuffer,
} from "../renderContributions";

describe("render contribution buffers", () => {
  it("reuses segment entries across frame resets", () => {
    const buffer = createWorldSegmentBuffer();
    const start = vec3.create(1, 2, 3);
    const end = vec3.create(4, 5, 6);
    const first = buffer.addSegment(start, end, { r: 1, g: 2, b: 3 }, 4);

    buffer.reset();
    start.x = 10;
    end.y = 20;
    const second = buffer.addSegment(start, end, { r: 7, g: 8, b: 9 }, 5);

    expect(second).toBe(first);
    expect(buffer.count).toBe(1);
    expect(buffer.items[0]).toMatchObject({
      color: { r: 7, g: 8, b: 9 },
      end: { x: 4, y: 20, z: 6 },
      lineWidth: 5,
      start: { x: 10, y: 2, z: 3 },
    });
  });

  it("reuses marker entries across frame resets", () => {
    const buffer = createWorldMarkerBuffer();
    const position = vec3.create(1, 2, 3);
    const first = buffer.addMarker(position, { r: 4, g: 5, b: 6 }, 7, 8, "dot");

    buffer.reset();
    position.z = 30;
    const second = buffer.addMarker(
      position,
      { r: 9, g: 10, b: 11 },
      12,
      13,
      "ring",
    );

    expect(second).toBe(first);
    expect(buffer.count).toBe(1);
    expect(buffer.items[0]).toMatchObject({
      color: { r: 9, g: 10, b: 11 },
      lineWidth: 13,
      position: { x: 1, y: 2, z: 30 },
      radius: 12,
      shape: "ring",
    });
  });
});
