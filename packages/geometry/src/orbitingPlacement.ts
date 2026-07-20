import type { LocalFrame } from "./localFrame";
import { mat3, type Mat3 } from "./mat3";
import { vec3, type Vec3 } from "./vec3";

export interface OrbitAnchorBody {
  mass: number;
  physicalRadius: number;
  position: Readonly<Vec3>;
  velocity: Readonly<Vec3>;
}

export interface OrbitingPlacement {
  angularVelocity: { pitch: number; roll: number; yaw: number };
  frame: LocalFrame;
  orientation: Mat3;
  position: Vec3;
  velocity: Vec3;
}

export interface OrbitingPlacementParams {
  altitudeMeters: number;
  anchorBody: OrbitAnchorBody;
  entityMass: number;
  ringCount: number;
  ringIndex: number;
}

const NEWTON_G = 6.6743e-11;
const EPS_LEN = 1e-6;
const EPS_LEN_STRICT = 1e-8;
const DOT_PARALLEL_COS = 1 - 1e-6;
const initialFrame: Readonly<LocalFrame> = {
  forward: { x: 1, y: 0, z: 0 },
  right: { x: 0, y: -1, z: 0 },
  up: { x: 0, y: 0, z: 1 },
};
const axisScratch = vec3.zero();
const rotationScratch = mat3.zero();
const rotatedForwardScratch = vec3.zero();

export function createOrbitingPlacement({
  altitudeMeters,
  anchorBody,
  entityMass,
  ringCount,
  ringIndex,
}: OrbitingPlacementParams): OrbitingPlacement {
  const radialDirection = vec3.normalizeInto(
    createRingDirection(ringIndex, ringCount),
  );
  const position = computeStartPosition(
    anchorBody.position,
    anchorBody.physicalRadius,
    altitudeMeters,
    radialDirection,
  );
  const velocity = computeOrbitVelocity(
    position,
    anchorBody.position,
    anchorBody.velocity,
    anchorBody.mass,
    entityMass,
  );
  const frame = getFrameFromVelocity(velocity);
  const orientation = localFrameIntoMat3(mat3.zero(), frame);

  return {
    angularVelocity: { pitch: 0, roll: 0, yaw: 0 },
    frame,
    orientation,
    position,
    velocity,
  };
}

function createRingDirection(index: number, count: number): Vec3 {
  const angle = (index / count) * Math.PI * 2;
  return vec3.create(Math.cos(angle), Math.sin(angle), 0);
}

function getFrameFromVelocity(velocity: Readonly<Vec3>): LocalFrame {
  const speed = vec3.length(velocity);
  if (speed === 0) return cloneLocalFrame(initialFrame);

  const targetForward = vec3.normalizeInto(vec3.clone(velocity));
  const baseForward = initialFrame.forward;
  const axis = vec3.crossInto(axisScratch, baseForward, targetForward);
  const axisLen = vec3.length(axis);

  if (axisLen < EPS_LEN) {
    const dot = vec3.dot(baseForward, targetForward);
    if (dot > DOT_PARALLEL_COS) return cloneLocalFrame(initialFrame);
    return {
      forward: vec3.scaleInto(vec3.zero(), -1, baseForward),
      right: vec3.scaleInto(vec3.zero(), -1, initialFrame.right),
      up: vec3.clone(initialFrame.up),
    };
  }

  const axisN = vec3.normalizeInto(axis);
  const dot = Math.min(1, Math.max(-1, vec3.dot(baseForward, targetForward)));
  const angle = Math.acos(dot);
  const frame = cloneLocalFrame(initialFrame);
  rotateLocalFrameAroundAxisInPlace(frame, axisN, angle);
  return frame;
}

function computeStartPosition(
  anchorPosition: Readonly<Vec3>,
  anchorRadius: number,
  altitude: number,
  radialDirection: Readonly<Vec3>,
): Vec3 {
  const offset = vec3.scaleInto(
    vec3.zero(),
    anchorRadius + altitude,
    radialDirection,
  );
  return vec3.addInto(vec3.zero(), anchorPosition, offset);
}

function computeOrbitVelocity(
  objectPosition: Readonly<Vec3>,
  anchorPosition: Readonly<Vec3>,
  anchorVelocity: Readonly<Vec3>,
  anchorMass: number,
  entityMass: number,
): Vec3 {
  const anchorVelocityCopy = vec3.clone(anchorVelocity);
  const offset = vec3.subInto(vec3.zero(), objectPosition, anchorPosition);
  const radius = vec3.length(offset);
  if (radius === 0) return anchorVelocityCopy;

  const radialDirection = vec3.scaleInto(offset, 1 / radius, offset);
  let tangentialDirection = vec3.zero();
  let hasTangentialDirection = false;

  const anchorSpeed = vec3.length(anchorVelocityCopy);
  if (anchorSpeed > 0) {
    const anchorDirection = vec3.scaleInto(
      vec3.zero(),
      1 / anchorSpeed,
      anchorVelocityCopy,
    );
    const projectionMagnitude = vec3.dot(anchorDirection, radialDirection);
    const projection = vec3.scaleInto(
      vec3.zero(),
      projectionMagnitude,
      radialDirection,
    );
    const tangential = vec3.subInto(vec3.zero(), anchorDirection, projection);
    if (vec3.length(tangential) > EPS_LEN_STRICT) {
      vec3.normalizeInto(tangential);
      tangentialDirection = tangential;
      hasTangentialDirection = true;
    }
  }

  if (!hasTangentialDirection) {
    const fallbackAxis =
      Math.abs(radialDirection.z) < 0.9
        ? vec3.create(0, 0, 1)
        : vec3.create(1, 0, 0);
    const tangential = vec3.crossInto(
      vec3.zero(),
      fallbackAxis,
      radialDirection,
    );
    vec3.normalizeInto(tangential);
    tangentialDirection = tangential;
  }

  const relativeSpeed = Math.sqrt(
    (NEWTON_G * (anchorMass + entityMass)) / radius,
  );
  const relativeVelocity = vec3.scaleInto(
    tangentialDirection,
    relativeSpeed,
    tangentialDirection,
  );
  return vec3.addInto(relativeVelocity, anchorVelocityCopy, relativeVelocity);
}

function cloneLocalFrame(frame: Readonly<LocalFrame>): LocalFrame {
  return {
    forward: vec3.clone(frame.forward),
    right: vec3.clone(frame.right),
    up: vec3.clone(frame.up),
  };
}

function localFrameIntoMat3(into: Mat3, frame: Readonly<LocalFrame>): Mat3 {
  const into0 = into[0];
  into0[0] = frame.right.x;
  into0[1] = frame.forward.x;
  into0[2] = frame.up.x;
  const into1 = into[1];
  into1[0] = frame.right.y;
  into1[1] = frame.forward.y;
  into1[2] = frame.up.y;
  const into2 = into[2];
  into2[0] = frame.right.z;
  into2[1] = frame.forward.z;
  into2[2] = frame.up.z;
  return into;
}

function rotateLocalFrameAroundAxisInPlace(
  frame: LocalFrame,
  axis: Readonly<Vec3>,
  angle: number,
): void {
  mat3.rotAxisInto(rotationScratch, axis, angle);
  mat3.mulVec3Into(frame.right, rotationScratch, frame.right);
  mat3.mulVec3Into(rotatedForwardScratch, rotationScratch, frame.forward);

  vec3.normalizeInto(frame.right);
  const dot = vec3.dot(rotatedForwardScratch, frame.right);
  vec3.scaleInto(frame.forward, dot, frame.right);
  vec3.subInto(frame.forward, rotatedForwardScratch, frame.forward);
  vec3.normalizeInto(frame.forward);
  vec3.crossInto(frame.up, frame.right, frame.forward);
  vec3.normalizeInto(frame.up);
}
