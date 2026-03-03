import { alloc } from "../global/allocProfiler.js";
import { type Mat3, mat3 } from "./mat3.js";
import { type Vec3, vec3 } from "./vec3.js";

export interface LocalFrame {
  right: Vec3;
  forward: Vec3;
  up: Vec3;
}

const worldForwardScratch = vec3.zero();

function clone(frame: Readonly<LocalFrame>): LocalFrame {
  return alloc.withName(clone.name, () => {
    return {
      right: vec3.clone(frame.right),
      forward: vec3.clone(frame.forward),
      up: vec3.clone(frame.up),
    };
  });
}

function copyInto(into: LocalFrame, frame: Readonly<LocalFrame>): void {
  vec3.copyInto(into.right, frame.right);
  vec3.copyInto(into.forward, frame.forward);
  vec3.copyInto(into.up, frame.up);
}

function fromUp(referenceUp: Readonly<Vec3>): LocalFrame {
  return alloc.withName(fromUp.name, () => {
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

/** Convert a LocalFrame to a local→world orientation matrix.
 *  Columns are basis vectors: [right | forward | up].
 */
function intoMat3(into: Mat3, frame: Readonly<LocalFrame>): Mat3 {
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
const rotateForwardScratch: Vec3 = vec3.zero();

/** Rotate a LocalFrame about an arbitrary axis in world space. */
function rotateAroundAxisInPlace(
  frame: LocalFrame,
  axis: Readonly<Vec3>,
  angle: number,
): void {
  mat3.rotAxisInto(R, axis, angle);

  mat3.mulVec3Into(frame.right, R, frame.right);
  mat3.mulVec3Into(rotateForwardScratch, R, frame.forward);

  // Gram–Schmidt to ensure orthonormal axes
  vec3.normalizeInto(frame.right);

  // Remove any component of forward along r, then normalize
  const dot = vec3.dot(rotateForwardScratch, frame.right);
  vec3.scaleInto(frame.forward, dot, frame.right);
  vec3.subInto(frame.forward, rotateForwardScratch, frame.forward);
  vec3.normalizeInto(frame.forward);

  // up = r × f to guarantee orthogonality
  vec3.crossInto(frame.up, frame.right, frame.forward);
  vec3.normalizeInto(frame.up);
}

export const localFrame = {
  clone,
  copyInto,
  fromUp,
  intoMat3,
  rotateAroundAxisInPlace,
};
