import type { Vec3 } from "./domainPorts.js";

function add(a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 {
  return addInto({ x: 0, y: 0, z: 0 }, a, b);
}

function addInto(into: Vec3, a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 {
  into.x = a.x + b.x;
  into.y = a.y + b.y;
  into.z = a.z + b.z;
  return into;
}

function add3(a: Readonly<Vec3>, b: Readonly<Vec3>, c: Readonly<Vec3>): Vec3 {
  return { x: a.x + b.x + c.x, y: a.y + b.y + c.y, z: a.z + b.z + c.z };
}

function clone(v: Readonly<Vec3>): Vec3 {
  return { x: v.x, y: v.y, z: v.z };
}

function cross(a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
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

function normalize(v: Readonly<Vec3>): Vec3 {
  return normalizeInto({ x: 0, y: 0, z: 0 }, v);
}

function normalizeInto(into: Vec3, v: Readonly<Vec3>): Vec3 {
  const len = length(v);
  if (len === 0) {
    into.x = 0;
    into.y = 0;
    into.z = 0;
    return into;
  }
  const invLen = 1 / len;
  into.x = v.x * invLen;
  into.y = v.y * invLen;
  into.z = v.z * invLen;
  return into;
}

function scale(v: Readonly<Vec3>, s: number): Vec3 {
  return scaleInto({ x: 0, y: 0, z: 0 }, s, v);
}

function scaleInto(into: Vec3, s: number, v: Readonly<Vec3>): Vec3 {
  into.x = v.x * s;
  into.y = v.y * s;
  into.z = v.z * s;
  return into;
}

function scaleAndAdd(a: Readonly<Vec3>, b: Readonly<Vec3>, s: number): Vec3 {
  return { x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s };
}

function sub(a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function subInto(into: Vec3, a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 {
  into.x = a.x - b.x;
  into.y = a.y - b.y;
  into.z = a.z - b.z;
  return into;
}

const zero: () => Vec3 = () => ({ x: 0, y: 0, z: 0 });

export const vec3 = {
  add,
  addInto,
  add3,
  clone,
  cross,
  crossInto,
  distSq,
  dot,
  length,
  lengthSq,
  normalize,
  normalizeInto,
  scale,
  scaleAndAdd,
  scaleInto,
  sub,
  subInto,
  zero,
};
