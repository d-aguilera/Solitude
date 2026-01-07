import { Mat3, mat3 } from "./mat3.js";
import type { LocalFrame, Vec3 } from "./types.js";
import { vec } from "./vec3.js";

/** Build a LocalFrame from right/forward/up, normalized and orthogonalized. */
export function makeLocalFrameFromAxes(
  right: Vec3,
  forward: Vec3,
  up: Vec3
): LocalFrame {
  const r = vec.normalize(right);
  const f = vec.normalize(forward);
  const u = vec.normalize(up);
  return { right: r, forward: f, up: u };
}

/** Extract a LocalFrame from a 3×3 orientation matrix (columns = [R,F,U]). */
export function localFrameFromMat3(R: Mat3): LocalFrame {
  const right: Vec3 = { x: R[0][0], y: R[1][0], z: R[2][0] };
  const forward: Vec3 = { x: R[0][1], y: R[1][1], z: R[2][1] };
  const up: Vec3 = { x: R[0][2], y: R[1][2], z: R[2][2] };
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
  const apply = (v: Vec3): Vec3 => ({
    x: R[0][0] * v.x + R[0][1] * v.y + R[0][2] * v.z,
    y: R[1][0] * v.x + R[1][1] * v.y + R[1][2] * v.z,
    z: R[2][0] * v.x + R[2][1] * v.y + R[2][2] * v.z,
  });
  return makeLocalFrameFromAxes(
    apply(frame.right),
    apply(frame.forward),
    apply(frame.up)
  );
}
