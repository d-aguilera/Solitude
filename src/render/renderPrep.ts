import type {
  PlanetSceneObject,
  SceneObject,
  ShipSceneObject,
  StarSceneObject,
} from "../app/appPorts.js";
import { type Mat3, mat3 } from "../domain/mat3.js";
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

// Per-object scratch arrays keyed by the SceneObject instance.
const objectWorldPointScratch = new WeakMap<SceneObject, Vec3[]>();

// Shared scratch array used when no per-object mapping is desired.
let sharedWorldPointScratch: Vec3[] = [];

/**
 * Convert a SceneObject into a Renderable with world-space points.
 */
export function toRenderable(
  obj: ShipSceneObject | PlanetSceneObject | StarSceneObject,
): Renderable {
  if (!obj.applyTransform) {
    // Polyline or other world-space-only geometry: no transform, no copies.
    return {
      mesh: obj.mesh,
      worldPoints: obj.mesh.points,
      lineWidth: obj.lineWidth,
      baseColor: obj.color,
    };
  }

  // Transformable object: compute world-space points in-place into
  // a reusable scratch array.
  const srcPoints = obj.mesh.points;
  const n = srcPoints.length;

  // Get or create a scratch array for this object.
  let dst = objectWorldPointScratch.get(obj);
  if (!dst || dst.length < n) {
    dst = ensureScratchCapacity(dst ?? [], n);
    objectWorldPointScratch.set(obj, dst);
  }

  transformPointsToWorldInPlace(
    srcPoints,
    dst,
    obj.orientation,
    obj.scale,
    obj.position,
  );

  return {
    mesh: obj.mesh,
    worldPoints: dst,
    lineWidth: obj.lineWidth,
    baseColor: obj.color,
  };
}

/**
 * Ensure the given scratch array has at least `n` Vec3 entries, reusing
 * existing instances when possible.
 */
function ensureScratchCapacity(dst: Vec3[], n: number): Vec3[] {
  return alloc.withName(ensureScratchCapacity.name, () => {
    const current = dst.length;
    for (let i = current; i < n; i++) {
      dst[i] = vec3.zero();
    }
    return dst;
  });
}

/**
 * Transform an array of local-space points into world space in-place,
 * writing results into the provided destination array.
 *
 * src and dst may be distinct arrays; dst will be resized if necessary
 * but existing Vec3 instances will be reused where possible.
 */
function transformPointsToWorldInPlace(
  src: Vec3[],
  dst: Vec3[],
  R: Readonly<Mat3>,
  s: number,
  position: Readonly<Vec3>,
): void {
  const pos = position;
  const n = src.length;
  if (dst.length < n) {
    ensureScratchCapacity(dst, n);
  }

  for (let i = 0; i < n; i++) {
    const local = src[i];
    const wp = dst[i];

    // Scale local point
    vec3.scaleInto(wp, s, local);
    // Rotate by orientation matrix
    mat3.mulVec3Into(wp, R, wp);
    // Translate by world position
    vec3.addInto(wp, wp, pos);
  }

  // If dst was previously longer, we do not shrink it here; callers
  // should use only the first `src.length` elements.
}

/**
 * Helper for callers that want a single shared scratch array instead of
 * a per-object mapping.
 *
 * Not currently used by the rest of the render pipeline but kept here
 * as a building block for future batching.
 */
function getSharedWorldPoints(
  src: Vec3[],
  R: Readonly<Mat3>,
  s: number,
  position: Readonly<Vec3>,
): Vec3[] {
  const n = src.length;

  if (sharedWorldPointScratch.length < n) {
    sharedWorldPointScratch = ensureScratchCapacity(sharedWorldPointScratch, n);
  }

  transformPointsToWorldInPlace(src, sharedWorldPointScratch, R, s, position);

  // Callers must treat only the first n entries as valid.
  return sharedWorldPointScratch;
}

void getSharedWorldPoints; // delete me if the function is ever used
