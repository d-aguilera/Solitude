function rotate2D(a, b, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  return {
    a: a * c - b * s,
    b: a * s + b * c,
  };
}

// --- 3D MATH HELPERS ---

// Multiply 3x3 matrices: C = A * B
function mat3Mul(A, B) {
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
function mat3MulVec(M, v) {
  return {
    x: M[0][0] * v.x + M[0][1] * v.y + M[0][2] * v.z,
    y: M[1][0] * v.x + M[1][1] * v.y + M[1][2] * v.z,
    z: M[2][0] * v.x + M[2][1] * v.y + M[2][2] * v.z,
  };
}

// Build a rotation matrix about X axis by angle (radians)
function mat3RotX(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [1, 0, 0],
    [0, c, -s],
    [0, s, c],
  ];
}

// Build a rotation matrix about Y axis by angle (radians)
function mat3RotY(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [c, 0, s],
    [0, 1, 0],
    [-s, 0, c],
  ];
}

// Build a rotation matrix about Z axis by angle (radians)
function mat3RotZ(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ];
}

// Transpose of 3x3 (used as inverse because orientation is orthonormal)
function mat3Transpose(M) {
  return [
    [M[0][0], M[1][0], M[2][0]],
    [M[0][1], M[1][1], M[2][1]],
    [M[0][2], M[1][2], M[2][2]],
  ];
}

function mat3RotAxis(axis, angle) {
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
