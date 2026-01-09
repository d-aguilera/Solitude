import { Mat3, mat3 } from "../../world/mat3.js";
import type { Renderable, SceneObject, Vec3 } from "../../world/types.js";
import { vec } from "../../world/vec3.js";

/**
 * Convert a SceneObject into a Renderable with world-space points.
 */
export function toRenderable(obj: SceneObject): Renderable {
  const worldPoints: Vec3[] = obj.applyTransform
    ? transformPointsToWorld(
        obj.mesh.points,
        obj.orientation,
        obj.scale,
        obj.position
      )
    : obj.mesh.points;

  return {
    mesh: obj.mesh,
    worldPoints,
    lineWidth: obj.lineWidth,
    baseColor: obj.color,
  };
}

function transformPointsToWorld(
  points: Vec3[],
  R: Mat3,
  s: number,
  position: Vec3
): Vec3[] {
  const out = new Array<Vec3>(points.length);

  for (let i = 0; i < points.length; i++) {
    // Scale in model space, then apply orientation, then translate
    const p = vec.scale(points[i], s);
    const rotated: Vec3 = mat3.mulVec3(R, p);
    out[i] = vec.add(rotated, position);
  }

  return out;
}
