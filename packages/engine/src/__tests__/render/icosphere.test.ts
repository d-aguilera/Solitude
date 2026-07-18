import { describe, expect, it } from "vitest";
import { vec3 } from "../../domain/vec3";
import { createUnitIcosphereMesh } from "../../render/icosphere";

describe(createUnitIcosphereMesh.name, () => {
  it("creates expected subdivision triangle counts on the unit sphere", () => {
    for (const subdivisions of [0, 1, 2, 3, 4]) {
      const mesh = createUnitIcosphereMesh(subdivisions);
      expect(mesh.faces).toHaveLength(20 * 4 ** subdivisions);
      expect(mesh.faceNormals).toHaveLength(mesh.faces.length);
      expect(
        mesh.points.every((point) => Math.abs(vec3.length(point) - 1) < 1e-12),
      ).toBe(true);
    }
  });
});
