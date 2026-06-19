import { vec3 } from "@solitude/engine/math";
import type { Mesh } from "@solitude/engine/render";
import { describe, expect, it } from "vitest";
import { getPackedGpuMesh, packGpuMesh } from "./meshPacking";

describe("GPU mesh packing", () => {
  it("flattens triangles with a shared face anchor and generated normal", () => {
    const mesh: Mesh = {
      faces: [[0, 1, 2]],
      points: [
        vec3.create(0, 0, 0),
        vec3.create(1, 0, 0),
        vec3.create(0, 1, 0),
      ],
    };

    const packed = packGpuMesh(mesh);

    expect(packed.boundingRadius).toBe(1);
    expect(packed.triangleCount).toBe(1);
    expect(packed.vertexCount).toBe(3);
    expect(Array.from(packed.data.slice(3, 9))).toEqual([0, 0, 1, 0, 0, 0]);
    expect(Array.from(packed.data.slice(12, 18))).toEqual([0, 0, 1, 0, 0, 0]);
  });

  it("reuses packed geometry for the same mesh identity", () => {
    const mesh: Mesh = {
      faces: [],
      points: [],
    };

    expect(getPackedGpuMesh(mesh)).toBe(getPackedGpuMesh(mesh));
  });
});
