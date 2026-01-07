import type { ScreenPoint } from "../projection/projection.js";
import { toRenderable } from "./renderPrep.js";
import type { SceneObject, Vec3 } from "../../world/types.js";
import { vec } from "../../world/vec3.js";

/**
 * Internal representation of a single shaded triangle face ready for rasterization.
 */
export type FaceEntry = {
  intensity: number;
  depth: number;
  p0: ScreenPoint;
  p1: ScreenPoint;
  p2: ScreenPoint;
  baseR: number;
  baseG: number;
  baseB: number;
};

/**
 * Build the list of shaded triangle faces (with depth and lighting information)
 * for all non-wireframe objects in the scene.
 */
export function buildShadedFaces(params: {
  objects: SceneObject[];
  projection: (p: Vec3) => ScreenPoint | null;
  cameraPos: Vec3 | null;
  lightDir: Vec3;
}): FaceEntry[] {
  const { objects, projection, cameraPos, lightDir } = params;
  const faceList: FaceEntry[] = [];

  objects.forEach((obj) => {
    if (obj.wireframeOnly) return;

    const { mesh, worldPoints, baseColor } = toRenderable(obj);
    const { faces } = mesh;
    const { r: baseR, g: baseG, b: baseB } = baseColor;

    for (let fi = 0; fi < faces.length; fi++) {
      const [i0, i1, i2] = faces[fi];
      const v0 = worldPoints[i0];
      const v1 = worldPoints[i1];
      const v2 = worldPoints[i2];

      const e1: Vec3 = {
        x: v1.x - v0.x,
        y: v1.y - v0.y,
        z: v1.z - v0.z,
      };
      const e2: Vec3 = {
        x: v2.x - v0.x,
        y: v2.y - v0.y,
        z: v2.z - v0.z,
      };
      const n = vec.normalize(vec.cross(e1, e2));

      // Back-face culling if we have a camera position
      if (cameraPos) {
        const toCamera: Vec3 = {
          x: cameraPos.x - v0.x,
          y: cameraPos.y - v0.y,
          z: cameraPos.z - v0.z,
        };
        const facing = vec.dot(n, toCamera);
        if (facing <= 0) continue;
      }

      const p0 = projection(v0);
      const p1 = projection(v1);
      const p2 = projection(v2);
      if (!p0 || !p1 || !p2) continue;

      const intensity = Math.max(0, vec.dot(n, lightDir));

      const d0 = p0.depth ?? 0;
      const d1 = p1.depth ?? 0;
      const d2 = p2.depth ?? 0;
      const avgDepth = (d0 + d1 + d2) / 3;

      faceList.push({
        intensity,
        depth: avgDepth,
        p0,
        p1,
        p2,
        baseR,
        baseG,
        baseB,
      });
    }
  });

  return faceList;
}
