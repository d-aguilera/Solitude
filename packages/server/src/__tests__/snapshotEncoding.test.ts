import type { RuntimeEntitySnapshot } from "@solitude/engine/runtime";
import { describe, expect, it } from "vitest";
import { compactSnapshotEntities } from "../snapshotEncoding";

describe("snapshot encoding", () => {
  it("rounds snapshot dynamic state without mutating the source", () => {
    const source: RuntimeEntitySnapshot = {
      angularVelocity: {
        pitch: 0.1234567,
        roll: 0.2345678,
        yaw: 0.3456789,
      },
      frame: {
        forward: { x: 0.1234567, y: 1.1234567, z: 2.1234567 },
        right: { x: 3.1234567, y: 4.1234567, z: 5.1234567 },
        up: { x: 6.1234567, y: 7.1234567, z: 8.1234567 },
      },
      id: "ship:blue",
      orientation: [
        [1.1234567, 0.1234567, 0],
        [0, 1.1234567, 0.1234567],
        [0.1234567, 0, 1.1234567],
      ],
      position: { x: 1.4, y: 2.5, z: -3.6 },
      velocity: { x: 4.1234567, y: 5.1234564, z: 6.1234565 },
    };

    const [encoded] = compactSnapshotEntities([source]);

    expect(encoded).toEqual({
      angularVelocity: {
        pitch: 0.123457,
        roll: 0.234568,
        yaw: 0.345679,
      },
      frame: {
        forward: { x: 0.123457, y: 1.123457, z: 2.123457 },
        right: { x: 3.123457, y: 4.123457, z: 5.123457 },
        up: { x: 6.123457, y: 7.123457, z: 8.123457 },
      },
      id: "ship:blue",
      orientation: [
        [1.123457, 0.123457, 0],
        [0, 1.123457, 0.123457],
        [0.123457, 0, 1.123457],
      ],
      position: { x: 1, y: 3, z: -4 },
      velocity: { x: 4.123457, y: 5.123456, z: 6.123457 },
    });
    expect(source.position).toEqual({ x: 1.4, y: 2.5, z: -3.6 });
  });
});
