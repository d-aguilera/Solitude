import { alloc } from "../global/allocProfiler.js";

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

function lerpInto(
  into: Vec3,
  a: Readonly<Vec3>,
  b: Readonly<Vec3>,
  t: number,
): Vec3 {
  vec3.subInto(into, b, a);
  vec3.scaleInto(into, t, into);
  vec3.addInto(into, into, a);
  return into;
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

function scaledAddInto(
  into: Vec3,
  base: Readonly<Vec3>,
  dir: Readonly<Vec3>,
  scale: number,
): Vec3 {
  vec3.scaleInto(into, scale, dir);
  vec3.addInto(into, into, base);
  return into;
}

function scaleInto(into: Vec3, s: Readonly<number>, v: Readonly<Vec3>): Vec3 {
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

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const vec3 = {
  /** `into` = `a` + `b` */
  addInto,
  /** Returns a copy of `v` */
  clone,
  /** Sets each component of `into` equal to the corresponding component of `v` */
  copyInto,
  /** Returns a new vector with the given components. */
  create,
  /** Sets `into` = `a` × `b` */
  crossInto,
  /** Returns the square of the distance between `a` and `b` */
  distSq,
  /** Returns `a` ⋅ `b` */
  dot,
  /** Returns the length of `v` */
  length,
  /** Returns the square of the length of `v` */
  lengthSq,
  /**
   * Sets `into` = `a` + `t` * (`b` - `a`)
   *
   * Linear interpolation between a and b.
   */
  lerpInto,
  /** Sets `into` = the normalized version of `into` */
  normalizeInto,
  /** Sets `into` = `base` + `dir` * `scale` */
  scaledAddInto,
  /** Sets `into` = `s` * `v` */
  scaleInto,
  /** Sets `into` = `a` - `b` */
  subInto,
  /** Returns a new vector with all components set to zero. */
  zero,
};
