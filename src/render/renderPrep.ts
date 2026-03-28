import type {
  PlanetSceneObject,
  SceneObject,
  ShipSceneObject,
  StarSceneObject,
} from "../app/scenePorts.js";
import { mat3 } from "../domain/mat3.js";
import { type Vec3, vec3 } from "../domain/vec3.js";
import { alloc } from "../global/allocProfiler.js";
import type { Renderable } from "./renderPorts.js";

/**
 * Convert a SceneObject into a Renderable with world-space points.
 *
 * For transformable objects, this uses scratch buffers and in-place math
 * to avoid per-call allocations. The returned worldPoints array and its
 * Vec3 elements are stable only for the duration of the current render
 * pass, not across frames.
 */
export function toRenderable(
  obj: ShipSceneObject | PlanetSceneObject | StarSceneObject,
): Renderable {
  const { applyTransform, color: baseColor, lineWidth, mesh } = obj;
  let worldPoints: Vec3[];

  if (applyTransform) {
    // Transformable object: compute world-space points in-place into
    // a reusable scratch array.
    const { orientation, position } = obj;
    const srcPoints = mesh.points;
    const n = srcPoints.length;
    worldPoints = getScratchArrayForObject(obj, n);
    for (let i = 0; i < n; i++) {
      const wp = worldPoints[i];
      // Rotate by orientation matrix
      mat3.mulVec3Into(wp, orientation, srcPoints[i]);
      // Translate by world position
      vec3.addInto(wp, wp, position);
    }
  } else {
    // Polyline or other world-space-only geometry: no transform, no copies.
    worldPoints = mesh.points;
  }

  return {
    mesh,
    worldPoints,
    lineWidth,
    baseColor,
  };
}

// Per-object scratch arrays keyed by the SceneObject instance.
const objectWorldPointScratch = new WeakMap<SceneObject, Vec3[]>();

/** Get or create a scratch array for a given object. */
function getScratchArrayForObject(
  obj: ShipSceneObject | PlanetSceneObject | StarSceneObject,
  n: number,
): Vec3[] {
  return alloc.withName(getScratchArrayForObject.name, () => {
    let dst = objectWorldPointScratch.get(obj);
    if (!dst) {
      dst = [];
      objectWorldPointScratch.set(obj, dst);
    }
    const length = dst.length;
    for (let i = length; i < n; i++) {
      dst.push(vec3.zero());
    }
    return dst;
  });
}
