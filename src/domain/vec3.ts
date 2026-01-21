import type { Vec3 } from "./domainPorts.js";

function add(a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 {
  return addInto({ x: 0, y: 0, z: 0 }, a, b);
}

function addInto(out: Vec3, a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 {
  out.x = a.x + b.x;
  out.y = a.y + b.y;
  out.z = a.z + b.z;
  return out;
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
  const len = length(v);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function scale(v: Readonly<Vec3>, s: number): Vec3 {
  return scaleInto({ x: 0, y: 0, z: 0 }, s, v);
}

function scaleInto(out: Vec3, s: number, v: Readonly<Vec3>): Vec3 {
  out.x = v.x * s;
  out.y = v.y * s;
  out.z = v.z * s;
  return out;
}

function scaleAndAdd(a: Readonly<Vec3>, b: Readonly<Vec3>, s: number): Vec3 {
  return { x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s };
}

function sub(a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export const vec3 = {
  add,
  addInto,
  add3,
  clone,
  cross,
  distSq,
  dot,
  length,
  lengthSq,
  normalize,
  scale,
  scaleAndAdd,
  scaleInto,
  sub,
};
