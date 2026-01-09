import { Mat3, mat3 } from "./mat3.js";
import type { LocalFrame, Vec3 } from "./types.js";
import { vec } from "./vec3.js";

export function makeLocalFrameFromUp(up: Vec3): LocalFrame {
  const u = vec.normalize(up);
  const worldForward: Vec3 =
    Math.abs(u.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };

  const dot = vec.dot(u, worldForward);
  const forwardUnnormalized = vec.sub(worldForward, vec.scale(u, dot));
  const forward = vec.normalize(forwardUnnormalized);
  const right = vec.normalize(vec.cross(forward, u));

  return { right, forward, up: u };
}

/** Extract a LocalFrame from a 3×3 orientation matrix (columns = [R,F,U]). */
export function localFrameFromMat3(R: Mat3): LocalFrame {
  const right = mat3.mulVec3(R, { x: 1, y: 0, z: 0 });
  const forward = mat3.mulVec3(R, { x: 0, y: 1, z: 0 });
  const up = mat3.mulVec3(R, { x: 0, y: 0, z: 1 });
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

  return makeLocalFrameFromAxes(
    mat3.mulVec3(R, frame.right),
    mat3.mulVec3(R, frame.forward),
    mat3.mulVec3(R, frame.up)
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
