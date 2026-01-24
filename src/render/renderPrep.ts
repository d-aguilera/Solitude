import type { SceneObject } from "../app/appPorts.js";
import type { Vec3, Mat3 } from "../domain/domainPorts.js";
import { mat3 } from "../domain/mat3.js";
import { vec3 } from "../domain/vec3.js";
import type { Renderable } from "./renderPorts.js";

/**
 * Convert a SceneObject into a Renderable with world-space points.
 */
export function toRenderable(obj: SceneObject): Renderable {
  if (!obj.applyTransform) {
    // Polyline or other world-space-only geometry: no transform, no copies.
    return {
      mesh: obj.mesh,
      worldPoints: obj.mesh.points,
      lineWidth: obj.lineWidth,
      baseColor: obj.color,
    };
  }

  // Transformable object
  const worldPoints = transformPointsToWorld(
    obj.mesh.points,
    obj.orientation,
    obj.scale,
    obj.position,
  );

  return {
    mesh: obj.mesh,
    worldPoints,
    lineWidth: obj.lineWidth,
    baseColor: obj.color,
  };
}

function transformPointsToWorld(
  src: Vec3[],
  R: Readonly<Mat3>,
  s: number,
  position: Readonly<Vec3>,
): Vec3[] {
  const pos = position;
  const n = src.length;
  const worldPoints = new Array<Vec3>(n);

  for (let i = 0; i < n; i++) {
    const wp = (worldPoints[i] = vec3.clone(src[i]));
    vec3.addInto(mat3.mulVec3Into(vec3.scaleInto(wp, s, wp), R, wp), pos, wp);
  }

  return worldPoints;
}
