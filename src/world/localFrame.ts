import { Mat3, mat3 } from "./mat3.js";
import type { LocalFrame, Vec3 } from "./types.js";
import { vec } from "./vec3.js";

export function makeLocalFrameFromUp(up: Vec3): LocalFrame {
  const u = vec.normalize(up);
  const worldForward: Vec3 =
    Math.abs(u.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };

  const dot = vec.dot(u, worldForward);
  let forward = vec.normalize(vec.sub(worldForward, vec.scale(u, dot)));
  let right = vec.normalize(vec.cross(forward, u));
  forward = vec.cross(u, right);

  return { right, forward, up: u };
}

/** Extract a LocalFrame from a 3×3 orientation matrix (columns = [R,F,U]). */
export function localFrameFromMat3(R: Mat3): LocalFrame {
  const R0 = R[0];
  const R1 = R[1];
  const R2 = R[2];
  const right: Vec3 = { x: R0[0], y: R1[0], z: R2[0] };
  const forward: Vec3 = { x: R0[1], y: R1[1], z: R2[1] };
  const up: Vec3 = { x: R0[2], y: R1[2], z: R2[2] };
  return makeLocalFrameFromAxes(right, forward, up);
}

/** Convert a LocalFrame to a column-major orientation matrix. */
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
  angle: number
): LocalFrame {
  const R = mat3.rotAxis(axis, angle);
  const R0 = R[0];
  const R1 = R[1];
  const R2 = R[2];
  const apply = (v: Vec3): Vec3 => ({
    x: R0[0] * v.x + R0[1] * v.y + R0[2] * v.z,
    y: R1[0] * v.x + R1[1] * v.y + R1[2] * v.z,
    z: R2[0] * v.x + R2[1] * v.y + R2[2] * v.z,
  });
  return makeLocalFrameFromAxes(
    apply(frame.right),
    apply(frame.forward),
    apply(frame.up)
  );
}

/** Build a LocalFrame from right/forward/up, normalized */
function makeLocalFrameFromAxes(
  right: Vec3,
  forward: Vec3,
  up: Vec3
): LocalFrame {
  const r = vec.normalize(right);
  const f = vec.normalize(forward);
  const u = vec.normalize(up);
  return { right: r, forward: f, up: u };
}
