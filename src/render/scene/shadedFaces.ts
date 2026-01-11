import {
  worldTriangleToScreenTriangles,
  type ScreenPoint,
} from "../projection/projection.js";
import { toRenderable } from "./renderPrep.js";
import type { LocalFrame, RGB, SceneObject, Vec3 } from "../../world/types.js";
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
  baseColor: RGB;
};

/**
 * Build the list of shaded triangle faces (with depth and lighting information)
 * for all non-wireframe objects in the scene.
 */
export function buildShadedFaces(params: {
  objects: SceneObject[];
  cameraPos: Vec3;
  cameraFrame: LocalFrame;
  canvasWidth: number;
  canvasHeight: number;
  lightDir: Vec3;
}): FaceEntry[] {
  const {
    objects,
    cameraPos,
    cameraFrame,
    canvasWidth,
    canvasHeight,
    lightDir,
  } = params;
  const faceList: FaceEntry[] = [];

  objects.forEach((obj) => {
    if (obj.wireframeOnly) return;

    const { mesh, worldPoints, baseColor } = toRenderable(obj);
    const { faces } = mesh;

    for (let fi = 0; fi < faces.length; fi++) {
      const [i0, i1, i2] = faces[fi];
      const v0 = worldPoints[i0];
      const v1 = worldPoints[i1];
      const v2 = worldPoints[i2];

      const e1 = vec.sub(v1, v0);
      const e2 = vec.sub(v2, v0);
      const n = vec.normalize(vec.cross(e1, e2));

      if (obj.backFaceCulling) {
        const toCamera = vec.sub(cameraPos, v0);
        const facing = vec.dot(n, toCamera);
        if (facing <= 0) continue;
      }

      const clippedTris = worldTriangleToScreenTriangles(
        v0,
        v1,
        v2,
        cameraPos,
        cameraFrame,
        canvasWidth,
        canvasHeight
      );
      if (clippedTris.length === 0) continue;

      const intensity = Math.max(0, vec.dot(n, lightDir));

      for (const { p0, p1, p2 } of clippedTris) {
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
          baseColor,
        });
      }
    }
  });

  return faceList;
}
