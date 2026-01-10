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

/** Extract a LocalFrame from a 3×3 orientation matrix (local→world). */
export function localFrameFromMat3(R: Mat3): LocalFrame {
  // R maps local -> world; columns are the world-space axes.
  const R0 = R[0];
  const R1 = R[1];
  const R2 = R[2];
  const right: Vec3 = { x: R0[0], y: R1[0], z: R2[0] };
  const forward: Vec3 = { x: R0[1], y: R1[1], z: R2[1] };
  const up: Vec3 = { x: R0[2], y: R1[2], z: R2[2] };

  return makeLocalFrameFromAxes(right, forward, up);
}

/** Convert a LocalFrame to a local→world orientation matrix (row-major). */
export function mat3FromLocalFrame(frame: LocalFrame): Mat3 {
  const { right, forward, up } = frame;

  // Local (x,y,z) -> World = x*right + y*forward + z*up
  // Implemented as v_world = R * v_local with rows = components of axes.
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
