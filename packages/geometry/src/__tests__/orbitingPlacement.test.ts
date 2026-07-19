import { describe, expect, it } from "vitest";
import { createOrbitingPlacement } from "../orbitingPlacement";
import { vec3 } from "../vec3";

describe(createOrbitingPlacement.name, () => {
  it("places ring members in circular orbits around a moving anchor", () => {
    const anchorBody = {
      mass: 5.972e24,
      physicalRadius: 6_371_000,
      position: vec3.create(1_000, 2_000, 3_000),
      velocity: vec3.create(0, 30_000, 0),
    };
    const first = createOrbitingPlacement({
      altitudeMeters: 100_000,
      anchorBody,
      entityMass: 1_000_000,
      ringCount: 2,
      ringIndex: 0,
    });
    const second = createOrbitingPlacement({
      altitudeMeters: 100_000,
      anchorBody,
      entityMass: 1_000_000,
      ringCount: 2,
      ringIndex: 1,
    });
    const firstOffset = vec3.subInto(
      vec3.zero(),
      first.position,
      anchorBody.position,
    );
    const secondOffset = vec3.subInto(
      vec3.zero(),
      second.position,
      anchorBody.position,
    );

    expect(vec3.length(firstOffset)).toBeCloseTo(6_471_000);
    expect(vec3.length(secondOffset)).toBeCloseTo(6_471_000);
    expect(vec3.dot(firstOffset, secondOffset)).toBeLessThan(0);
    expect(vec3.length(first.frame.forward)).toBeCloseTo(1);
    expect(first.angularVelocity).toEqual({ pitch: 0, roll: 0, yaw: 0 });
  });
});
