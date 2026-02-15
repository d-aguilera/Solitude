import { alloc } from "../global/allocProfiler.js";
import type { LocalFrame, Mat3, Vec3 } from "./domainPorts.js";
import { mat3 } from "./mat3.js";
import { vec3 } from "./vec3.js";

const worldForwardScratch = vec3.zero();

export function makeLocalFrameFromUp(referenceUp: Vec3): LocalFrame {
  return alloc.withName(makeLocalFrameFromUp.name, () => {
    // Work on a normalized copy so that the caller's vector is not modified.
    const up = vec3.clone(referenceUp);
    vec3.normalizeInto(up);

    const forward = vec3.zero();
    if (Math.abs(up.z) < 0.9) {
      worldForwardScratch.x = 0;
      worldForwardScratch.z = 1;
    } else {
      worldForwardScratch.x = 1;
      worldForwardScratch.z = 0;
    }
    const dot = vec3.dot(up, worldForwardScratch);
    vec3.scaleInto(forward, dot, up);
    vec3.subInto(forward, worldForwardScratch, forward);
    vec3.normalizeInto(forward);

    const right = vec3.zero();
    vec3.crossInto(right, forward, up);
    vec3.normalizeInto(right);

    alloc.vec3();
    return { right, forward, up };
  });
}

/** Extract a LocalFrame from a 3×3 orientation matrix (local→world).
 *  Columns of R are the world-space axes of the local frame.
 */
export function localFrameFromMat3(R: Mat3): LocalFrame {
  return alloc.withName(localFrameFromMat3.name, () => {
    const R0 = R[0];
    const R1 = R[1];
    const R2 = R[2];
    const right: Vec3 = vec3.create(R0[0], R1[0], R2[0]);
    const forward: Vec3 = vec3.create(R0[1], R1[1], R2[1]);
    const up: Vec3 = vec3.create(R0[2], R1[2], R2[2]);

    return makeLocalFrameFromAxes(right, forward, up);
  });
}

/** Convert a LocalFrame to a local→world orientation matrix.
 *  Columns are basis vectors: [right | forward | up].
 */
export function mat3FromLocalFrame(frame: LocalFrame): Mat3 {
  return alloc.withName(mat3FromLocalFrame.name, () => {
    return mat3FromLocalFrameInto(mat3.zero(), frame);
  });
}

export function mat3FromLocalFrameInto(into: Mat3, frame: LocalFrame): Mat3 {
  const { right, forward, up } = frame;
  const into0 = into[0];
  into0[0] = right.x;
  into0[1] = forward.x;
  into0[2] = up.x;
  const into1 = into[1];
  into1[0] = right.y;
  into1[1] = forward.y;
  into1[2] = up.y;
  const into2 = into[2];
  into2[0] = right.z;
  into2[1] = forward.z;
  into2[2] = up.z;
  return into;
}

// Shared scratch vectors for rotateFrameAroundAxis
const R = mat3.zero();
const rotateRightScratch: Vec3 = vec3.zero();
const rotateForwardScratch: Vec3 = vec3.zero();
const rotateUpScratch: Vec3 = vec3.zero();

/** Rotate a LocalFrame about an arbitrary axis in world space. */
export function rotateFrameAroundAxis(
  frame: LocalFrame,
  axis: Vec3,
  angle: number,
): LocalFrame {
  return alloc.withName(rotateFrameAroundAxis.name, () => {
    mat3.rotAxisInto(R, axis, angle);

    // Use scratch Vec3s + mulVec3Into to avoid allocations
    mat3.mulVec3Into(rotateRightScratch, R, frame.right);
    mat3.mulVec3Into(rotateForwardScratch, R, frame.forward);
    mat3.mulVec3Into(rotateUpScratch, R, frame.up);

    // Return a new LocalFrame built from the rotated axes
    return makeLocalFrameFromAxes(
      rotateRightScratch,
      rotateForwardScratch,
      rotateUpScratch,
    );
  });
}

/** Build a LocalFrame from right/forward/up */
function makeLocalFrameFromAxes(
  right: Vec3,
  forward: Vec3,
  up: Vec3,
): LocalFrame {
  return alloc.withName(makeLocalFrameFromAxes.name, () => {
    // Gram–Schmidt to ensure orthonormal axes
    const r = vec3.clone(right);
    vec3.normalizeInto(r);

    // Remove any component of forward along r, then normalize
    const f = vec3.zero();
    const dot = vec3.dot(forward, r);
    vec3.scaleInto(f, dot, r);
    vec3.subInto(f, forward, f);
    vec3.normalizeInto(f);

    // up = r × f to guarantee orthogonality
    const u = vec3.zero();
    vec3.crossInto(u, r, f);
    vec3.normalizeInto(u);
    void up;

    return { right: r, forward: f, up: u };
  });
}
