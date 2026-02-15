import { alloc } from "../global/allocProfiler.js";
import type { Mat3, Vec3 } from "./domainPorts.js";

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

function copy(from: Mat3, to: Mat3): Mat3 {
  const to0 = to[0];
  const to1 = to[1];
  const to2 = to[2];
  [to0[0], to0[1], to0[2]] = from[0];
  [to1[0], to1[1], to1[2]] = from[1];
  [to2[0], to2[1], to2[2]] = from[2];
  return to;
}

/**
 * Apply a 3×3 matrix to a Vec3 (v' = R * v), treating COLUMNS as basis vectors.
 *
 * If R's columns are [r | f | u], then:
 *   v' = v.x * r + v.y * f + v.z * u
 */
function mulVec3Into(out: Vec3, R: Readonly<Mat3>, v: Readonly<Vec3>): void {
  const { x, y, z } = v,
    R0 = R[0],
    R1 = R[1],
    R2 = R[2];

  out.x = R0[0] * x + R0[1] * y + R0[2] * z;
  out.y = R1[0] * x + R1[1] * y + R1[2] * z;
  out.z = R2[0] * x + R2[1] * y + R2[2] * z;
}

/**
 * Matrix multiplication C = A * B for 3×3 matrices.
 *
 * Both A and B are local→world rotation matrices in the same convention.
 */
function mulMat3Into(into: Mat3, A: Readonly<Mat3>, B: Readonly<Mat3>): void {
  const into0 = into[0];
  const into1 = into[1];
  const into2 = into[2];
  const [A00, A01, A02] = A[0];
  const [A10, A11, A12] = A[1];
  const [A20, A21, A22] = A[2];
  const [B00, B01, B02] = B[0];
  const [B10, B11, B12] = B[1];
  const [B20, B21, B22] = B[2];
  into0[0] = A00 * B00 + A01 * B10 + A02 * B20;
  into0[1] = A00 * B01 + A01 * B11 + A02 * B21;
  into0[2] = A00 * B02 + A01 * B12 + A02 * B22;
  into1[0] = A10 * B00 + A11 * B10 + A12 * B20;
  into1[1] = A10 * B01 + A11 * B11 + A12 * B21;
  into1[2] = A10 * B02 + A11 * B12 + A12 * B22;
  into2[0] = A20 * B00 + A21 * B10 + A22 * B20;
  into2[1] = A20 * B01 + A21 * B11 + A22 * B21;
  into2[2] = A20 * B02 + A21 * B12 + A22 * B22;
}

function rotAxisInto(into: Mat3, axis: Readonly<Vec3>, angle: number): void {
  let { x, y, z } = axis;

  const len = Math.hypot(x, y, z);

  // Degenerate axis → identity
  if (len === 0) {
    copy(identity, into);
    return;
  }

  x /= len;
  y /= len;
  z /= len;

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

  const into0 = into[0];
  into0[0] = txx + c;
  into0[1] = txy - zs;
  into0[2] = tzx + ys;
  const into1 = into[1];
  into1[0] = txy + zs;
  into1[1] = tyy + c;
  into1[2] = tyz - xs;
  const into2 = into[2];
  into2[0] = tzx - ys;
  into2[1] = tyz + xs;
  into2[2] = tzz + c;
}

function rotXInto(into: Mat3, angle: number): void {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const into0 = into[0];
  into0[0] = 1;
  into0[1] = 0;
  into0[2] = 0;
  const into1 = into[1];
  into1[0] = 0;
  into1[1] = c;
  into1[2] = -s;
  const into2 = into[2];
  into2[0] = 0;
  into2[1] = s;
  into2[2] = c;
}

function rotZInto(into: Mat3, angle: number): void {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const into0 = into[0];
  into0[0] = c;
  into0[1] = -s;
  into0[2] = 0;
  const into1 = into[1];
  into1[0] = s;
  into1[1] = c;
  into1[2] = 0;
  const into2 = into[2];
  into2[0] = 0;
  into2[1] = 0;
  into2[2] = 1;
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
  copy,
  mulVec3Into,
  mulMat3Into,
  rotAxisInto,
  rotXInto,
  rotZInto,
  transposeInto,
  zero,
};
