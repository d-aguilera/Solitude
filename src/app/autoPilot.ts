import type { World } from "../domain/domainPorts";
import { localFrame } from "../domain/localFrame";
import { getDominantBody } from "../domain/orbit";
import { type Vec3, vec3 } from "../domain/vec3";
import type { ControlledBodyState } from "./appInternals";

// Max rate at which the ship can reorient itself toward its velocity vector.
const alignToVelocityMaxAngularSpeed = 0.0007; // rad/ms

// Scratch vectors
const dominantBodyScratch = vec3.zero();
const velocityScratch: Vec3 = vec3.zero();
const targetForwardScratch: Vec3 = vec3.zero();
const fullAxisScratch: Vec3 = vec3.zero();
const fallbackAxisScratch: Vec3 = vec3.zero();
const axisScratch: Vec3 = vec3.zero();

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
