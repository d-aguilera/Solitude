import { describe, expect, it } from "vitest";
import { raySphereFirstHitDistance } from "../raySphere";
import { vec3 } from "../vec3";

describe("raySphereFirstHitDistance", () => {
  it("returns the nearest forward surface intersection", () => {
    expect(
      raySphereFirstHitDistance(
        vec3.zero(),
        vec3.create(0, 1, 0),
        vec3.create(0, 100, 0),
        10,
      ),
    ).toBe(90);
  });

  it("rejects misses and spheres behind the ray", () => {
    const origin = vec3.zero();
    const direction = vec3.create(0, 1, 0);
    expect(
      raySphereFirstHitDistance(origin, direction, vec3.create(20, 100, 0), 10),
    ).toBeNull();
    expect(
      raySphereFirstHitDistance(origin, direction, vec3.create(0, -100, 0), 10),
    ).toBeNull();
  });
});
