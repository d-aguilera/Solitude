import { describe, expect, it } from "vitest";
import { computeVolumeOfTriangleMesh } from "../meshVolume";
import { vec3 } from "../vec3";

describe(computeVolumeOfTriangleMesh.name, () => {
  it("computes tetrahedron volume (and is translation-invariant)", () => {
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

    const v0 = computeVolumeOfTriangleMesh(points, faces);
    expect(v0).toBeCloseTo(1 / 6, 10);

    const offset = vec3.create(100, -200, 300);
    const moved = points.map((point) =>
      vec3.create(point.x + offset.x, point.y + offset.y, point.z + offset.z),
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
    const scale = 7;
    const scaled = points.map((point) =>
      vec3.create(point.x * scale, point.y * scale, point.z * scale),
    );
    const scaledVolume = computeVolumeOfTriangleMesh(scaled, faces);

    expect(scaledVolume).toBeCloseTo(base * scale * scale * scale, 10);
  });
});
