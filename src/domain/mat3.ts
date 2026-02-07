import { alloc } from "../global/allocProfiler.js";
import type { Mat3, Vec3 } from "./domainPorts.js";
import { vec3 } from "./vec3.js";

/**
 * 3×3 rotation matrix stored in row-major order.
 * Convention:
 *   - Vectors are treated as column vectors.
 *   - Columns of the matrix are basis vectors (e.g., right | forward | up).
 */
const identity: Mat3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

/**
 * Apply a 3×3 matrix to a Vec3 (v' = R * v), treating COLUMNS as basis vectors.
 *
 * If R's columns are [r | f | u], then:
 *   v' = v.x * r + v.y * f + v.z * u
 */
function mulVec3(R: Readonly<Mat3>, v: Readonly<Vec3>): Vec3 {
  return mulVec3Into(vec3.zero(), R, v);
}

/**
 * In-place mulVec3: out = R * v, using the same column-basis convention.
 */
function mulVec3Into(out: Vec3, R: Readonly<Mat3>, v: Readonly<Vec3>): Vec3 {
  const { x, y, z } = v,
    R0 = R[0],
    R1 = R[1],
    R2 = R[2];

  out.x = R0[0] * x + R0[1] * y + R0[2] * z;
  out.y = R1[0] * x + R1[1] * y + R1[2] * z;
  out.z = R2[0] * x + R2[1] * y + R2[2] * z;

  return out;
}

/**
 * Matrix multiplication C = A * B for 3×3 matrices.
 *
 * Both A and B are local→world rotation matrices in the same convention.
 */
function mulMat3(A: Readonly<Mat3>, B: Readonly<Mat3>): Mat3 {
  alloc.mat3();
  const A0 = A[0],
    A00 = A0[0],
    A01 = A0[1],
    A02 = A0[2],
    A1 = A[1],
    A10 = A1[0],
    A11 = A1[1],
    A12 = A1[2],
    A2 = A[2],
    A20 = A2[0],
    A21 = A2[1],
    A22 = A2[2],
    B0 = B[0],
    B00 = B0[0],
    B01 = B0[1],
    B02 = B0[2],
    B1 = B[1],
    B10 = B1[0],
    B11 = B1[1],
    B12 = B1[2],
    B2 = B[2],
    B20 = B2[0],
    B21 = B2[1],
    B22 = B2[2];

  return [
    [
      A00 * B00 + A01 * B10 + A02 * B20,
      A00 * B01 + A01 * B11 + A02 * B21,
      A00 * B02 + A01 * B12 + A02 * B22,
    ],
    [
      A10 * B00 + A11 * B10 + A12 * B20,
      A10 * B01 + A11 * B11 + A12 * B21,
      A10 * B02 + A11 * B12 + A12 * B22,
    ],
    [
      A20 * B00 + A21 * B10 + A22 * B20,
      A20 * B01 + A21 * B11 + A22 * B21,
      A20 * B02 + A21 * B12 + A22 * B22,
    ],
  ];
}

function rotAxis(axis: Readonly<Vec3>, angle: number): Mat3 {
  alloc.mat3();
  let { x, y, z } = axis;

  const len = Math.hypot(x, y, z);

  // Degenerate axis → identity
  if (len === 0) {
    return identity;
  }

  const invLen = 1 / len;
  x *= invLen;
  y *= invLen;
  z *= invLen;

  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;

  const tx = t * x;
  const txx = tx * x;
  const txy = tx * y;
  const ty = t * y;
  const tyy = ty * y;
  const tyz = ty * z;
  const tz = t * z;
  const tzz = tz * z;
  const tzx = tz * x;
  const xs = x * s;
  const ys = y * s;
  const zs = z * s;

  return [
    [txx + c, txy - zs, tzx + ys],
    [txy + zs, tyy + c, tyz - xs],
    [tzx - ys, tyz + xs, tzz + c],
  ];
}

function transpose(M: Readonly<Mat3>): Mat3 {
  alloc.mat3();
  const M0 = M[0];
  const M1 = M[1];
  const M2 = M[2];
  return [
    [M0[0], M1[0], M2[0]],
    [M0[1], M1[1], M2[1]],
    [M0[2], M1[2], M2[2]],
  ];
}

function transposeInto(into: Mat3, M: Readonly<Mat3>): Mat3 {
  const M0 = M[0];
  const M1 = M[1];
  const M2 = M[2];
  const into0 = into[0];
  into0[0] = M0[0];
  into0[1] = M1[0];
  into0[2] = M2[0];
  const into1 = into[1];
  into1[0] = M0[1];
  into1[1] = M1[1];
  into1[2] = M2[1];
  const into2 = into[2];
  into2[0] = M0[2];
  into2[1] = M1[2];
  into2[2] = M2[2];
  return into;
}

function zero(): Mat3 {
  alloc.mat3();
  return [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
}

export const mat3 = {
  identity,
  mulVec3,
  mulVec3Into,
  mulMat3,
  rotAxis,
  transpose,
  transposeInto,
  zero,
};
