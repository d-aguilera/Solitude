import { alloc } from "../global/allocProfiler.js";
import type { Vec3 } from "./domainPorts.js";

function addInto(into: Vec3, a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 {
  into.x = a.x + b.x;
  into.y = a.y + b.y;
  into.z = a.z + b.z;
  return into;
}

function clone(v: Readonly<Vec3>): Vec3 {
  alloc.vec3();
  return { x: v.x, y: v.y, z: v.z };
}

function copyInto(into: Vec3, v: Readonly<Vec3>): Vec3 {
  into.x = v.x;
  into.y = v.y;
  into.z = v.z;
  return into;
}

function create(x: number, y: number, z: number): Vec3 {
  alloc.vec3();
  return { x, y, z };
}

function crossInto(into: Vec3, a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 {
  into.x = a.y * b.z - a.z * b.y;
  into.y = a.z * b.x - a.x * b.z;
  into.z = a.x * b.y - a.y * b.x;
  return into;
}

function distSq(a: Readonly<Vec3>, b: Readonly<Vec3>): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function dot(a: Readonly<Vec3>, b: Readonly<Vec3>): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function length(v: Readonly<Vec3>): number {
  return Math.hypot(v.x, v.y, v.z);
}

function lengthSq(v: Readonly<Vec3>): number {
  return v.x * v.x + v.y * v.y + v.z * v.z;
}

/**
 * out = a + t * (b - a)
 *
 * Linear interpolation between a and b.
 */
function lerpInto(
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

function normalizeInto(into: Vec3): Vec3 {
  const len = length(into);
  if (len === 0) {
    into.x = 0;
    into.y = 0;
    into.z = 0;
    return into;
  }
  const invLen = 1 / len;
  into.x *= invLen;
  into.y *= invLen;
  into.z *= invLen;
  return into;
}

/**
 * out = base + dir * scale
 *
 * Common pattern for offsetting a point along a direction.
 */
function scaledAdd(
  out: Vec3,
  base: Readonly<Vec3>,
  dir: Readonly<Vec3>,
  scale: number,
): Vec3 {
  vec3.scaleInto(out, scale, dir);
  vec3.addInto(out, out, base);
  return out;
}

function scaleInto(into: Vec3, s: number, v: Readonly<Vec3>): Vec3 {
  into.x = v.x * s;
  into.y = v.y * s;
  into.z = v.z * s;
  return into;
}

function subInto(into: Vec3, a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 {
  into.x = a.x - b.x;
  into.y = a.y - b.y;
  into.z = a.z - b.z;
  return into;
}

const zero: () => Vec3 = () => {
  alloc.vec3();
  return { x: 0, y: 0, z: 0 };
};

export const vec3 = {
  addInto,
  clone,
  copyInto,
  create,
  crossInto,
  distSq,
  dot,
  length,
  lengthSq,
  lerpInto,
  normalizeInto,
  scaledAdd,
  scaleInto,
  subInto,
  zero,
};
