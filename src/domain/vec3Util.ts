import type { Vec3 } from "./domainPorts.js";
import { vec3 } from "./vec3.js";

/**
 * out = base + dir * scale
 *
 * Common pattern for offsetting a point along a direction.
 */
export function scaledAdd(
  out: Vec3,
  base: Readonly<Vec3>,
  dir: Readonly<Vec3>,
  scale: number,
): Vec3 {
  vec3.scaleInto(out, scale, dir);
  vec3.addInto(out, out, base);
  return out;
}

/**
 * out = a + t * (b - a)
 *
 * Linear interpolation between a and b.
 */
export function lerpInto(
  out: Vec3,
  a: Readonly<Vec3>,
  b: Readonly<Vec3>,
  t: number,
): Vec3 {
  // out = b - a
  vec3.subInto(out, b, a);
  // out = out * t
  vec3.scaleInto(out, t, out);
  // out = a + out
  vec3.addInto(out, out, a);
  return out;
}

/**
 * out = normalize(a - b)
 *
 * Returns 0-vector if a == b.
 */
export function normalizeDiffInto(
  out: Vec3,
  a: Readonly<Vec3>,
  b: Readonly<Vec3>,
): Vec3 {
  vec3.subInto(out, a, b);
  return vec3.normalizeInto(out);
}

/**
 * out = cross(normalize(a), normalize(b))
 *
 * Useful when you conceptually want the cross of unit directions and
 * don't care about reusing the normalized intermediates.
 */
export function normalizedCrossInto(
  out: Vec3,
  a: Readonly<Vec3>,
  b: Readonly<Vec3>,
): Vec3 {
  const na = vec3.clone(a);
  const nb = vec3.clone(b);
  vec3.normalizeInto(na);
  vec3.normalizeInto(nb);
  vec3.crossInto(out, na, nb);
  return out;
}

/**
 * Safe normalize: if v is (near) zero, returns zero vector in-place.
 */
export function safeNormalizeInto(out: Vec3): Vec3 {
  const lenSq = vec3.lengthSq(out);
  if (lenSq === 0) {
    out.x = 0;
    out.y = 0;
    out.z = 0;
    return out;
  }
  return vec3.normalizeInto(out);
}
