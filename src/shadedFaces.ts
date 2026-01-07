import type { ScreenPoint } from "./projection.js";
import { toRenderable } from "./renderPrep.js";
import type { SceneObject, Vec3 } from "./types.js";
import { vec } from "./vec3.js";

/**
 * Internal representation of a single shaded triangle face ready for rasterization.
 * Kept separate from SceneObject / Mesh to keep the draw pipeline cohesive.
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
 *
 * This keeps the responsibilities of:
 *  - deriving world-space triangles from scene objects
 *  - applying camera-based back-face culling
 *  - computing per-face lighting intensity
 *  - projecting to screen-space
 *
 * separate from the actual rasterization, which lives in draw.ts.
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
    if (obj.wireframeOnly) {
      return;
    }

    const { mesh, worldPoints } = toRenderable(obj);
    const { color, faces } = mesh;

    let baseR = 255;
    let baseG = 255;
    let baseB = 255;
    if (typeof color !== "string" && color) {
      baseR = color.r;
      baseG = color.g;
      baseB = color.b;
    }

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
        if (facing <= 0) {
          continue;
        }
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
