import type { Vec3 } from "./types.js";

export type Mat3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number]
];

const identity: Mat3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

function mul(A: Mat3, B: Mat3): Mat3 {
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

function rotAxis(axis: Vec3, angle: number): Mat3 {
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

export const mat3 = {
  identity,
  mul,
  rotAxis,
};
