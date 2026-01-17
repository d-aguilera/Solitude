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
function mulVec3(R: Mat3, v: Vec3): Vec3 {
  const right: Vec3 = { x: R[0][0], y: R[1][0], z: R[2][0] };
  const forward: Vec3 = { x: R[0][1], y: R[1][1], z: R[2][1] };
  const up: Vec3 = { x: R[0][2], y: R[1][2], z: R[2][2] };

  return {
    x: right.x * v.x + forward.x * v.y + up.x * v.z,
    y: right.y * v.x + forward.y * v.y + up.y * v.z,
    z: right.z * v.x + forward.z * v.y + up.z * v.z,
  };
}

function rotAxis(axis: Vec3, angle: number): Mat3 {
  const n = vec3.normalize(axis);
  const len = vec3.length(n);

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
  mulVec3,
  rotAxis,
  transpose,
};
