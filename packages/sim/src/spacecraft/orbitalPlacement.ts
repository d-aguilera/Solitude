import {
  circularSpeedAtRadius,
  DOT_PARALLEL_COS,
  EPS_LEN,
  EPS_LEN_STRICT,
  localFrame,
  mat3,
  vec3,
  type LocalFrame,
  type Vec3,
} from "@solitude/engine/math";
import { initialFrame } from "@solitude/engine/world";
import type { CelestialBody } from "../celestialBodies/provider";
import type { DirectControllableEntityPlacement } from "../controllableEntities/provider";

export interface OrbitingPlacementParams {
  altitudeMeters: number;
  anchorBody: CelestialBody;
  entityMass: number;
  ringCount: number;
  ringIndex: number;
}

const axisScratch = vec3.zero();

export function createOrbitingPlacement({
  altitudeMeters,
  anchorBody,
  entityMass,
  ringCount,
  ringIndex,
}: OrbitingPlacementParams): DirectControllableEntityPlacement {
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
  const orientation = localFrame.intoMat3(mat3.zero(), frame);

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

function getFrameFromVelocity(velocity: Vec3): LocalFrame {
  const speed = vec3.length(velocity);
  if (speed === 0) {
    return localFrame.clone(initialFrame);
  }

  const targetForward = vec3.normalizeInto(vec3.clone(velocity));
  const baseForward = initialFrame.forward;
  const axis = vec3.crossInto(axisScratch, baseForward, targetForward);
  const axisLen = vec3.length(axis);

  if (axisLen < EPS_LEN) {
    const dot = vec3.dot(baseForward, targetForward);
    if (dot > DOT_PARALLEL_COS) {
      return localFrame.clone(initialFrame);
    }
    return {
      forward: vec3.scaleInto(vec3.zero(), -1, baseForward),
      right: vec3.scaleInto(vec3.zero(), -1, initialFrame.right),
      up: vec3.clone(initialFrame.up),
    };
  }

  const axisN = vec3.normalizeInto(axis);
  const dot = Math.min(1, Math.max(-1, vec3.dot(baseForward, targetForward)));
  const angle = Math.acos(dot);
  const frame = localFrame.clone(initialFrame);
  localFrame.rotateAroundAxisInPlace(frame, axisN, angle);
  return frame;
}

function computeStartPosition(
  planetPosition: Vec3,
  planetRadius: number,
  altitude: number,
  radialDirection: Vec3,
): Vec3 {
  const offset = vec3.scaleInto(
    vec3.zero(),
    planetRadius + altitude,
    radialDirection,
  );

  return vec3.addInto(vec3.zero(), planetPosition, offset);
}

function computeOrbitVelocity(
  objectPosition: Vec3,
  planetPosition: Vec3,
  planetVelocity: Vec3,
  planetMass: number,
  entityMass: number,
): Vec3 {
  const vPlanet = vec3.clone(planetVelocity);
  const offset = vec3.subInto(vec3.zero(), objectPosition, planetPosition);
  const r = vec3.length(offset);
  if (r === 0) {
    return vPlanet;
  }

  const radialDir = vec3.scaleInto(offset, 1 / r, offset);
  let tangentialDir = vec3.zero();
  let hasTangential = false;

  const planetSpeed = vec3.length(vPlanet);
  if (planetSpeed > 0) {
    const planetDir = vec3.scaleInto(vec3.zero(), 1 / planetSpeed, vPlanet);
    const projMag = vec3.dot(planetDir, radialDir);
    const proj = vec3.scaleInto(vec3.zero(), projMag, radialDir);
    const tangential = vec3.subInto(vec3.zero(), planetDir, proj);
    if (vec3.length(tangential) > EPS_LEN_STRICT) {
      vec3.normalizeInto(tangential);
      tangentialDir = tangential;
      hasTangential = true;
    }
  }

  if (!hasTangential) {
    const fallbackAxis =
      Math.abs(radialDir.z) < 0.9 ? vec3.create(0, 0, 1) : vec3.create(1, 0, 0);
    const tangential = vec3.crossInto(vec3.zero(), fallbackAxis, radialDir);
    vec3.normalizeInto(tangential);
    tangentialDir = tangential;
  }

  const vRelMag = circularSpeedAtRadius(planetMass + entityMass, r);
  const vRel = vec3.scaleInto(tangentialDir, vRelMag, tangentialDir);
  return vec3.addInto(vRel, vPlanet, vRel);
}
