import type { Mat3, Vec3 } from "./types.js";

export function rotate2D(
  a: number,
  b: number,
  angle: number
): { a: number; b: number } {
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  return {
    a: a * c - b * s,
    b: a * s + b * c,
  };
}

export const mat3 = {
  mul: mat3Mul,
  rotAxis: mat3RotAxis,
};

function mat3Mul(A: Mat3, B: Mat3): Mat3 {
  const C: Mat3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      C[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j];
    }
  }
  return C;
}

function mat3RotAxis(axis: Vec3, angle: number): Mat3 {
  const { x, y, z } = axis;
  const len = Math.hypot(x, y, z);
  if (len === 0) {
    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
  }
  const nx = x / len;
  const ny = y / len;
  const nz = z / len;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;

  return [
    [t * nx * nx + c, t * nx * ny - s * nz, t * nx * nz + s * ny],
    [t * ny * nx + s * nz, t * ny * ny + c, t * ny * nz - s * nx],
    [t * nz * nx - s * ny, t * nz * ny + s * nx, t * nz * nz + c],
  ];
}

export const vec = {
  add: vecAdd,
  cross: vecCross,
  dot: vecDot,
  length: vecLength,
  normalize: vecNormalize,
  sub: vecSub,
  scale: vecScale,
  scaleToUnit: vecScaleToUnit,
};

export function vecAdd(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function vecCross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function vecDot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function vecLength(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

function vecNormalize(v: Vec3): Vec3 {
  const len = vecLength(v);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function vecSub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function vecScale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function vecScaleToUnit(v: Vec3): Vec3 {
  const len = vecLength(v);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function transformPointsToWorld(
  points: Vec3[],
  R: Mat3,
  s: number,
  tx: number,
  ty: number,
  tz: number
): Vec3[] {
  const out = new Array<Vec3>(points.length);

  for (let i = 0; i < points.length; i++) {
    const { x, y, z } = points[i];
    const lx = x * s;
    const ly = y * s;
    const lz = z * s;
    const R0 = R[0];
    const R1 = R[1];
    const R2 = R[2];

    out[i] = {
      x: R0[0] * lx + R0[1] * ly + R0[2] * lz + tx,
      y: R1[0] * lx + R1[1] * ly + R1[2] * lz + ty,
      z: R2[0] * lx + R2[1] * ly + R2[2] * lz + tz,
    };
  }

  return out;
}
