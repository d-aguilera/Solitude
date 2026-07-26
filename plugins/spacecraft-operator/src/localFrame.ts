import { mat3, vec3, type Mat3, type Vec3 } from "@solitude/plugin-api/math";
import type { ExternalLocalFrame } from "@solitude/plugin-api/world";

const rotation = mat3.zero();
const rotatedForward = vec3.zero();
const worldForward = vec3.zero();

function copyInto(
  into: ExternalLocalFrame,
  frame: Readonly<ExternalLocalFrame>,
): void {
  vec3.copyInto(into.right, frame.right);
  vec3.copyInto(into.forward, frame.forward);
  vec3.copyInto(into.up, frame.up);
}

function fromUp(referenceUp: Readonly<Vec3>): ExternalLocalFrame {
  const up = vec3.clone(referenceUp);
  vec3.normalizeInto(up);

  const forward = vec3.zero();
  if (Math.abs(up.z) < 0.9) {
    worldForward.x = 0;
    worldForward.z = 1;
  } else {
    worldForward.x = 1;
    worldForward.z = 0;
  }
  const dot = vec3.dot(up, worldForward);
  vec3.scaleInto(forward, dot, up);
  vec3.subInto(forward, worldForward, forward);
  vec3.normalizeInto(forward);

  const right = vec3.zero();
  vec3.crossInto(right, forward, up);
  vec3.normalizeInto(right);
  return { forward, right, up };
}

function intoMat3(into: Mat3, frame: Readonly<ExternalLocalFrame>): Mat3 {
  const { forward, right, up } = frame;
  into[0][0] = right.x;
  into[0][1] = forward.x;
  into[0][2] = up.x;
  into[1][0] = right.y;
  into[1][1] = forward.y;
  into[1][2] = up.y;
  into[2][0] = right.z;
  into[2][1] = forward.z;
  into[2][2] = up.z;
  return into;
}

function rotateAroundAxisInPlace(
  frame: ExternalLocalFrame,
  axis: Readonly<Vec3>,
  angle: number,
): void {
  mat3.rotAxisInto(rotation, axis, angle);
  mat3.mulVec3Into(frame.right, rotation, frame.right);
  mat3.mulVec3Into(rotatedForward, rotation, frame.forward);
  vec3.normalizeInto(frame.right);

  const dot = vec3.dot(rotatedForward, frame.right);
  vec3.scaleInto(frame.forward, dot, frame.right);
  vec3.subInto(frame.forward, rotatedForward, frame.forward);
  vec3.normalizeInto(frame.forward);
  vec3.crossInto(frame.up, frame.right, frame.forward);
  vec3.normalizeInto(frame.up);
}

function zero(): ExternalLocalFrame {
  return {
    forward: vec3.zero(),
    right: vec3.zero(),
    up: vec3.zero(),
  };
}

export const localFrame = {
  copyInto,
  fromUp,
  intoMat3,
  rotateAroundAxisInPlace,
  zero,
};
