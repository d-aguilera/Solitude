import { Vec3 } from "../../world/domain.js";
import { Mat3 } from "../../world/mat3.js";
import type {
  Renderable,
  SceneObject,
  SceneObjectWithCache,
} from "../../world/types.js";

/**
 * Convert a SceneObject into a Renderable with world-space points.
 * Reuses a per-object worldPoints cache to avoid per-frame allocations.
 */
export function toRenderable(obj: SceneObject): Renderable {
  const cachedObj = obj as SceneObjectWithCache;

  let worldPoints: Vec3[];

  if (!obj.applyTransform) {
    // Polyline or other world-space-only geometry: no transform, no copies.
    worldPoints = obj.mesh.points;
  } else {
    // Transformable object: cache worldPoints buffer on the object
    const srcPoints = obj.mesh.points;
    const n = srcPoints.length;

    let cache = cachedObj.__worldPointsCache;
    if (!cache || cache.length !== n) {
      cache = new Array<Vec3>(n);
      for (let i = 0; i < n; i++) {
        cache[i] = { x: 0, y: 0, z: 0 };
      }
      cachedObj.__worldPointsCache = cache;
    }

    transformPointsToWorldInPlace(
      srcPoints,
      cache,
      obj.orientation,
      obj.scale,
      obj.position
    );

    worldPoints = cache;
  }

  return {
    mesh: obj.mesh,
    worldPoints,
    lineWidth: obj.lineWidth,
    baseColor: obj.color,
  };
}

function transformPointsToWorldInPlace(
  src: Vec3[],
  dst: Vec3[],
  R: Mat3,
  s: number,
  position: Vec3
): void {
  const r0 = R[0];
  const r00 = r0[0],
    r01 = r0[1],
    r02 = r0[2];
  const r1 = R[1];
  const r10 = r1[0],
    r11 = r1[1],
    r12 = r1[2];
  const r2 = R[2];
  const r20 = r2[0],
    r21 = r2[1],
    r22 = r2[2];

  const px = position.x;
  const py = position.y;
  const pz = position.z;

  const n = src.length;

  for (let i = 0; i < n; i++) {
    const sp = src[i];
    const dx = sp.x * s;
    const dy = sp.y * s;
    const dz = sp.z * s;

    // rotated = R * (scaled model point), using column-basis convention
    const rx = r00 * dx + r01 * dy + r02 * dz;
    const ry = r10 * dx + r11 * dy + r12 * dz;
    const rz = r20 * dx + r21 * dy + r22 * dz;

    const out = dst[i];
    out.x = rx + px;
    out.y = ry + py;
    out.z = rz + pz;
  }
}
