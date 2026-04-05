import { describe, expect, it } from "vitest";
import { computeVolumeOfTriangleMesh } from "../meshVolume";
import { vec3 } from "../vec3";

describe(computeVolumeOfTriangleMesh.name, () => {
  it("computes tetrahedron volume (and is translation-invariant)", () => {
    // Right tetrahedron with volume = 1/6.
    const points = [
      vec3.create(0, 0, 0),
      vec3.create(1, 0, 0),
      vec3.create(0, 1, 0),
      vec3.create(0, 0, 1),
    ];

    // Consistent outward winding.
    const faces = [
      [0, 2, 1],
      [0, 1, 3],
      [0, 3, 2],
      [1, 2, 3],
    ];

    const v0 = computeVolumeOfTriangleMesh(points, faces);
    expect(v0).toBeCloseTo(1 / 6, 10);

    // Translate all points; volume should not change.
    const offset = vec3.create(100, -200, 300);
    const moved = points.map((p) =>
      vec3.create(p.x + offset.x, p.y + offset.y, p.z + offset.z),
    );
    const v1 = computeVolumeOfTriangleMesh(moved, faces);
    expect(v1).toBeCloseTo(1 / 6, 10);
  });

  it("scales with s^3", () => {
    const points = [
      vec3.create(0, 0, 0),
      vec3.create(1, 0, 0),
      vec3.create(0, 1, 0),
      vec3.create(0, 0, 1),
    ];

    const faces = [
      [0, 2, 1],
      [0, 1, 3],
      [0, 3, 2],
      [1, 2, 3],
    ];

    const base = computeVolumeOfTriangleMesh(points, faces);

    const s = 7;
    const scaled = points.map((p) => vec3.create(p.x * s, p.y * s, p.z * s));
    const vScaled = computeVolumeOfTriangleMesh(scaled, faces);

    expect(vScaled).toBeCloseTo(base * s * s * s, 10);
  });
});
