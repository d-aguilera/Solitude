export function rotate2D(a, b, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  return {
    a: a * c - b * s,
    b: a * s + b * c,
  };
}

// --- 3D MATH HELPERS ---

// Multiply 3x3 matrices: C = A * B
export function mat3Mul(A, B) {
  const C = [
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

// Multiply a 3x3 matrix by a vector: v' = M * v
export function mat3MulVec(M, v) {
  return {
    x: M[0][0] * v.x + M[0][1] * v.y + M[0][2] * v.z,
    y: M[1][0] * v.x + M[1][1] * v.y + M[1][2] * v.z,
    z: M[2][0] * v.x + M[2][1] * v.y + M[2][2] * v.z,
  };
}

// Transform a normal from model space to world space given orientation + per-axis scale
export function transformNormalToWorld(normal, R, width, depth, height) {
  // For purely uniform scale, we could just do mat3MulVec(R, normal).
  // Here buildings can have per-axis dimensions encoded as width/depth/height,
  // which correspond to non-uniform scale along the local axes.
  //
  // To account for non-uniform scaling, we need to multiply by the inverse-transpose
  // of the scale*rotation matrix. For our diagonal-like scaling, that effectively
  // means dividing by each axis scale after rotating.
  //
  // Approximate: worldNormal = R * (normal / axisScale), then renormalize.
  const sx = width || 1;
  const sy = depth || 1;
  const sz = height || 1;

  const nLocal = {
    x: normal.x / sx,
    y: normal.y / sy,
    z: normal.z / sz,
  };

  const nw = mat3MulVec(R, nLocal);

  const len = Math.hypot(nw.x, nw.y, nw.z);
  if (len > 0) {
    nw.x /= len;
    nw.y /= len;
    nw.z /= len;
  }

  return nw;
}

// Build a rotation matrix about X axis by angle (radians)
export function mat3RotX(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [1, 0, 0],
    [0, c, -s],
    [0, s, c],
  ];
}

// Build a rotation matrix about Y axis by angle (radians)
export function mat3RotY(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [c, 0, s],
    [0, 1, 0],
    [-s, 0, c],
  ];
}

// Build a rotation matrix about Z axis by angle (radians)
export function mat3RotZ(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ];
}

// Transpose of 3x3 (used as inverse because orientation is orthonormal)
export function mat3Transpose(M) {
  return [
    [M[0][0], M[1][0], M[2][0]],
    [M[0][1], M[1][1], M[2][1]],
    [M[0][2], M[1][2], M[2][2]],
  ];
}

export function mat3RotAxis(axis, angle) {
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

export function transformPointsToWorld(points, R, s, tx, ty, tz) {
  const out = new Array(points.length);

  for (let i = 0; i < points.length; i++) {
    const { x, y, z } = points[i];
    const lx = x * s;
    const ly = y * s;
    const lz = z * s;
    const R0 = R[0];
    const R1 = R[1];
    const R2 = R[2];

    out[i] = {
      // R * local + translation
      x: R0[0] * lx + R0[1] * ly + R0[2] * lz + tx,
      y: R1[0] * lx + R1[1] * ly + R1[2] * lz + ty,
      z: R2[0] * lx + R2[1] * ly + R2[2] * lz + tz,
    };
  }

  return out;
}
