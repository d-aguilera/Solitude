import type { LocalFrame, Mat3, Vec3 } from "./domainPorts.js";
import { mat3 } from "./mat3.js";
import { vec3 } from "./vec3.js";

export function makeLocalFrameFromUp(up: Vec3): LocalFrame {
  const u = vec3.normalize(up);
  const worldForward: Vec3 =
    Math.abs(u.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };

  const dot = vec3.dot(u, worldForward);
  const forwardUnnormalized = vec3.sub(worldForward, vec3.scale(u, dot));
  const forward = vec3.normalize(forwardUnnormalized);
  const right = vec3.normalize(vec3.cross(forward, u));

  return { right, forward, up: u };
}

/** Extract a LocalFrame from a 3×3 orientation matrix (local→world).
 *  Columns of R are the world-space axes of the local frame.
 */
export function localFrameFromMat3(R: Mat3): LocalFrame {
  const R0 = R[0];
  const R1 = R[1];
  const R2 = R[2];
  const right: Vec3 = { x: R0[0], y: R1[0], z: R2[0] };
  const forward: Vec3 = { x: R0[1], y: R1[1], z: R2[1] };
  const up: Vec3 = { x: R0[2], y: R1[2], z: R2[2] };

  return makeLocalFrameFromAxes(right, forward, up);
}

/** Convert a LocalFrame to a local→world orientation matrix.
 *  Columns are basis vectors: [right | forward | up].
 */
export function mat3FromLocalFrame(frame: LocalFrame): Mat3 {
  const { right, forward, up } = frame;

  return [
    [right.x, forward.x, up.x],
    [right.y, forward.y, up.y],
    [right.z, forward.z, up.z],
  ];
}

/** Rotate a LocalFrame about an arbitrary axis in world space. */
export function rotateFrameAroundAxis(
  frame: LocalFrame,
  axis: Vec3,
  angle: number,
): LocalFrame {
  const R = mat3.rotAxis(axis, angle);

  return makeLocalFrameFromAxes(
    mat3.mulVec3(R, frame.right),
    mat3.mulVec3(R, frame.forward),
    mat3.mulVec3(R, frame.up),
  );
}

/** Build a LocalFrame from right/forward/up */
function makeLocalFrameFromAxes(
  right: Vec3,
  forward: Vec3,
  up: Vec3,
): LocalFrame {
  // Gram–Schmidt to ensure orthonormal axes
  let r = vec3.normalize(right);
  // Remove any component of forward along r, then normalize
  let fUn = vec3.sub(forward, vec3.scale(r, vec3.dot(forward, r)));
  let f = vec3.normalize(fUn);
  void up;
  // up = r × f to guarantee orthogonality
  let u = vec3.normalize(vec3.cross(r, f));

  return { right: r, forward: f, up: u };
}
