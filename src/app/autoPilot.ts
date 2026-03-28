import type { World } from "../domain/domainPorts";
import { localFrame } from "../domain/localFrame";
import { getDominantBody, getDominantBodyPrimary } from "../domain/orbit";
import { type Vec3, vec3 } from "../domain/vec3";
import { parameters } from "../global/parameters";
import type { ControlledBodyState } from "./appInternals";
import type { ThrustCommand } from "./controls";

// Max rate at which the ship can reorient itself toward its velocity vector.
const alignToVelocityMaxAngularSpeed = 0.0007; // rad/ms

// Scratch vectors
const dominantBodyScratch = vec3.zero();
const velocityScratch: Vec3 = vec3.zero();
const targetForwardScratch: Vec3 = vec3.zero();
const fullAxisScratch: Vec3 = vec3.zero();
const fallbackAxisScratch: Vec3 = vec3.zero();
const axisScratch: Vec3 = vec3.zero();
const tangentialScratch: Vec3 = vec3.zero();
const rScratch: Vec3 = vec3.zero();
const rHatScratch: Vec3 = vec3.zero();
const vRelScratch: Vec3 = vec3.zero();
const rollAxisScratch: Vec3 = vec3.zero();
const rollProjectedScratch: Vec3 = vec3.zero();
const circleRScratch: Vec3 = vec3.zero();
const circleRHatScratch: Vec3 = vec3.zero();
const circleVRelScratch: Vec3 = vec3.zero();
const circleTScratch: Vec3 = vec3.zero();
const circleDeltaVScratch: Vec3 = vec3.zero();
const circleAccelScratch: Vec3 = vec3.zero();

// Max rate at which the ship can roll to align with a tangential direction.
const alignToTangentMaxAngularSpeed = 0.001; // rad/ms

const circleZeroThrust: ThrustCommand = { forward: 0, right: 0 };

export function getDominantBodyDirection(
  { position }: ControlledBodyState,
  world: World,
): Vec3 | null {
  const body = getDominantBody(world, position);
  if (!body) {
    return null;
  }

  vec3.subInto(dominantBodyScratch, body.position, position);
  if (vec3.lengthSq(dominantBodyScratch) === 0) {
    return null;
  }

  return dominantBodyScratch;
}

export function getVelocityDirection({
  velocity,
}: ControlledBodyState): Vec3 | null {
  const speed = vec3.length(velocity);
  if (speed === 0) {
    // No meaningful velocity direction to align to.
    return null;
  }

  // targetForward = v / speed
  vec3.scaleInto(velocityScratch, 1 / speed, velocity);
  return velocityScratch;
}

export function getTangentialDirection(
  ship: ControlledBodyState,
  world: World,
): Vec3 | null {
  const primary = getDominantBodyPrimary(world, ship.position);
  if (!primary) return null;

  vec3.subInto(rScratch, ship.position, primary.body.position);
  const rLen = vec3.length(rScratch);
  if (rLen === 0) return null;
  vec3.scaleInto(rHatScratch, 1 / rLen, rScratch);

  vec3.subInto(vRelScratch, ship.velocity, primary.body.velocity);
  const radialSpeed = vec3.dot(rHatScratch, vRelScratch);
  vec3.scaleInto(tangentialScratch, radialSpeed, rHatScratch);
  vec3.subInto(tangentialScratch, vRelScratch, tangentialScratch);

  const tLen = vec3.length(tangentialScratch);
  if (tLen > 1e-4) {
    vec3.scaleInto(tangentialScratch, 1 / tLen, tangentialScratch);
    return tangentialScratch;
  }

  // Fallback: use ship-right projected onto the orbital plane.
  vec3.copyInto(tangentialScratch, ship.frame.right);
  const proj = vec3.dot(tangentialScratch, rHatScratch);
  tangentialScratch.x -= proj * rHatScratch.x;
  tangentialScratch.y -= proj * rHatScratch.y;
  tangentialScratch.z -= proj * rHatScratch.z;
  const projLen = vec3.length(tangentialScratch);
  if (projLen <= 1e-4) return null;

  vec3.scaleInto(tangentialScratch, 1 / projLen, tangentialScratch);
  return tangentialScratch;
}

/**
 * Roll-only alignment: rotate around forward axis so the ship's right axis
 * aligns with the target direction projected onto the roll plane.
 */
export function alignFrameRollToDirection(
  dtMillis: number,
  state: ControlledBodyState,
  targetDirection: Vec3,
): void {
  const len = vec3.length(targetDirection);
  if (len === 0) return;

  const forward = state.frame.forward;

  vec3.scaleInto(rollProjectedScratch, 1 / len, targetDirection);
  const proj = vec3.dot(rollProjectedScratch, forward);
  rollProjectedScratch.x -= proj * forward.x;
  rollProjectedScratch.y -= proj * forward.y;
  rollProjectedScratch.z -= proj * forward.z;

  const projLen = vec3.length(rollProjectedScratch);
  if (projLen < 1e-6) return;
  vec3.scaleInto(rollProjectedScratch, 1 / projLen, rollProjectedScratch);

  const currentRight = state.frame.right;
  const dot = vec3.dot(currentRight, rollProjectedScratch);
  const clampedDot = Math.min(1, Math.max(-1, dot));
  const angle = Math.acos(clampedDot);
  if (angle < 1e-4) return;

  vec3.crossInto(rollAxisScratch, currentRight, rollProjectedScratch);
  const sign = vec3.dot(rollAxisScratch, forward) >= 0 ? 1 : -1;

  const maxStep = alignToTangentMaxAngularSpeed * dtMillis;
  const stepAngle = Math.min(angle, maxStep) * sign;
  localFrame.rotateAroundAxisInPlace(state.frame, forward, stepAngle);
}

export function applyCircleNowOrientation(
  dtMillis: number,
  ship: ControlledBodyState,
  world: World,
): boolean {
  let didAlign = false;

  const inward = getDominantBodyDirection(ship, world);
  if (inward) {
    alignFrameToDirection(dtMillis, ship, inward);
    didAlign = true;
  }

  const tangential = getTangentialDirection(ship, world);
  if (tangential) {
    alignFrameRollToDirection(dtMillis, ship, tangential);
    didAlign = true;
  }

  return didAlign;
}

/**
 * Gradually rotate the body's frame so that its forward axis aligns with the
 * specified target direction.
 *
 * Rotation is rate-limited to {@link alignToVelocityMaxAngularSpeed} so that the
 * effect feels like small attitude-control thrusters rather than an instantaneous snap.
 * The function handles edge cases including when the target direction is zero-length,
 * when vectors are parallel/anti-parallel, or when they are nearly aligned.
 */
export function alignFrameToDirection(
  dtMillis: number,
  state: ControlledBodyState,
  targetDirection: Vec3,
): void {
  const len = vec3.length(targetDirection);
  if (len === 0) return;

  vec3.scaleInto(targetForwardScratch, 1 / len, targetDirection);
  const targetForward = targetForwardScratch;
  const currentForward = state.frame.forward;

  // If we're already nearly aligned, do nothing.
  const dot = vec3.dot(currentForward, targetForward);
  const clampedDot = Math.min(1, Math.max(-1, dot));
  const angle = Math.acos(clampedDot);
  if (angle < 1e-4) {
    return;
  }

  // fullAxis = currentForward × targetForward
  vec3.crossInto(fullAxisScratch, currentForward, targetForward);
  const fullAxis = fullAxisScratch;
  const axisLen = vec3.length(fullAxis);
  if (axisLen < 1e-6) {
    // Parallel or anti-parallel: simple axis choice.
    if (clampedDot > 0) {
      // Same direction: nothing to do.
      return;
    }
    // Opposite direction: choose an axis orthogonal to forward.
    const up = state.frame.up;
    vec3.crossInto(fallbackAxisScratch, currentForward, up);
    const fallbackAxis = fallbackAxisScratch;
    const fallbackLen = vec3.length(fallbackAxis);
    if (fallbackLen < 1e-6) {
      // As a last resort, use the frame's right axis.
      const axis = state.frame.right;
      const maxStep = alignToVelocityMaxAngularSpeed * dtMillis;
      const stepAngle = Math.min(Math.PI, maxStep);
      localFrame.rotateAroundAxisInPlace(state.frame, axis, stepAngle);
      return;
    }

    vec3.scaleInto(axisScratch, 1 / fallbackLen, fallbackAxis);
    const maxStep = alignToVelocityMaxAngularSpeed * dtMillis;
    const stepAngle = Math.min(Math.PI, maxStep);
    localFrame.rotateAroundAxisInPlace(state.frame, axisScratch, stepAngle);
    return;
  }

  // General case: rotate partially toward the target, clamped by max angular speed.
  vec3.scaleInto(axisScratch, 1 / axisLen, fullAxis);
  const maxStep = alignToVelocityMaxAngularSpeed * dtMillis;
  const stepAngle = Math.min(angle, maxStep);
  localFrame.rotateAroundAxisInPlace(state.frame, axisScratch, stepAngle);
}

export function computeCircleNowThrust(
  dtMillis: number,
  ship: ControlledBodyState,
  world: World,
  maxThrustPercent: number,
  maxThrustAcceleration: number,
): ThrustCommand {
  if (maxThrustPercent <= 0 || maxThrustAcceleration <= 0) {
    return circleZeroThrust;
  }
  const dtSec = dtMillis / 1000;
  if (dtSec <= 0) return circleZeroThrust;

  const primary = getDominantBodyPrimary(world, ship.position);
  if (!primary) return circleZeroThrust;

  vec3.subInto(circleRScratch, ship.position, primary.body.position);
  const r2 = vec3.lengthSq(circleRScratch);
  if (r2 === 0) return circleZeroThrust;
  const r = Math.sqrt(r2);
  vec3.scaleInto(circleRHatScratch, 1 / r, circleRScratch);

  vec3.subInto(circleVRelScratch, ship.velocity, primary.body.velocity);
  const radialSpeed = vec3.dot(circleRHatScratch, circleVRelScratch);

  vec3.scaleInto(circleTScratch, radialSpeed, circleRHatScratch);
  vec3.subInto(circleTScratch, circleVRelScratch, circleTScratch);
  const tangentialSpeed = vec3.length(circleTScratch);
  let hasTangentialDir = false;
  if (tangentialSpeed > 1e-6) {
    vec3.scaleInto(circleTScratch, 1 / tangentialSpeed, circleTScratch);
    hasTangentialDir = true;
  } else {
    vec3.copyInto(circleTScratch, ship.frame.right);
    const proj = vec3.dot(circleTScratch, circleRHatScratch);
    circleTScratch.x -= proj * circleRHatScratch.x;
    circleTScratch.y -= proj * circleRHatScratch.y;
    circleTScratch.z -= proj * circleRHatScratch.z;
    const projLen = vec3.length(circleTScratch);
    if (projLen > 1e-6) {
      vec3.scaleInto(circleTScratch, 1 / projLen, circleTScratch);
      hasTangentialDir = true;
    }
  }

  const mu = parameters.newtonG * primary.mass;
  if (mu === 0) return circleZeroThrust;

  const circularSpeed = Math.sqrt(mu / r);
  const deltaVRadial = -radialSpeed;
  const deltaVTangential = circularSpeed - tangentialSpeed;

  circleDeltaVScratch.x = circleRHatScratch.x * deltaVRadial;
  circleDeltaVScratch.y = circleRHatScratch.y * deltaVRadial;
  circleDeltaVScratch.z = circleRHatScratch.z * deltaVRadial;

  if (hasTangentialDir) {
    circleDeltaVScratch.x += circleTScratch.x * deltaVTangential;
    circleDeltaVScratch.y += circleTScratch.y * deltaVTangential;
    circleDeltaVScratch.z += circleTScratch.z * deltaVTangential;
  }

  const deltaVMag = vec3.length(circleDeltaVScratch);
  if (deltaVMag < 1e-9) return circleZeroThrust;

  const maxAccel = maxThrustAcceleration * clamp(maxThrustPercent, 0, 1);
  const maxDeltaV = maxAccel * dtSec;
  if (maxDeltaV <= 0) return circleZeroThrust;

  let scale = 1;
  if (deltaVMag > maxDeltaV) {
    scale = maxDeltaV / deltaVMag;
  }
  circleAccelScratch.x = (circleDeltaVScratch.x * scale) / dtSec;
  circleAccelScratch.y = (circleDeltaVScratch.y * scale) / dtSec;
  circleAccelScratch.z = (circleDeltaVScratch.z * scale) / dtSec;

  const forwardCmd =
    vec3.dot(circleAccelScratch, ship.frame.forward) / maxThrustAcceleration;
  const rightCmd =
    vec3.dot(circleAccelScratch, ship.frame.right) / maxThrustAcceleration;

  return {
    forward: clamp(forwardCmd, -maxThrustPercent, maxThrustPercent),
    right: clamp(rightCmd, -maxThrustPercent, maxThrustPercent),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
