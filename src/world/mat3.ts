import type { Vec3 } from "./types.js";
import { vec } from "./vec3.js";

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

/** Apply a 3×3 matrix to a Vec3 (R * v), treating rows as basis vectors. */
function mulVec3(R: Mat3, v: Vec3): Vec3 {
  const R0 = R[0];
  const R1 = R[1];
  const R2 = R[2];

  const row0: Vec3 = { x: R0[0], y: R0[1], z: R0[2] };
  const row1: Vec3 = { x: R1[0], y: R1[1], z: R1[2] };
  const row2: Vec3 = { x: R2[0], y: R2[1], z: R2[2] };

  return {
    x: vec.dot(row0, v),
    y: vec.dot(row1, v),
    z: vec.dot(row2, v),
  };
}

function rotAxis(axis: Vec3, angle: number): Mat3 {
  const n = vec.normalize(axis);
  const len = vec.length(n);

  // Degenerate axis → identity
  if (len === 0) {
    return identity;
  }

  const { x: nx, y: ny, z: nz } = n;

  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;

  return [
    [t * nx * nx + c, t * nx * ny - s * nz, t * nx * nz + s * ny],
    [t * ny * nx + s * nz, t * ny * ny + c, t * ny * nz - s * nx],
    [t * nz * nx - s * ny, t * nz * ny + s * nx, t * nz * nz + c],
  ];
}

function transpose(M: Mat3): Mat3 {
  const M0 = M[0];
  const M1 = M[1];
  const M2 = M[2];
  return [
    [M0[0], M1[0], M2[0]],
    [M0[1], M1[1], M2[1]],
    [M0[2], M1[2], M2[2]],
  ];
}

export const mat3 = {
  identity,
  mul,
  mulVec3,
  rotAxis,
  transpose,
};
