import type { LocalFrame, ShipBody } from "../domain/domainPorts.js";
import { rotateFrameAroundAxis } from "../domain/localFrame.js";
import { vec3 } from "../domain/vec3.js";
import type { ControlledBodyState } from "./appInternals.js";
import type {
  ControlInput,
  SimControlState,
  PilotLookState,
} from "./appPorts.js";

// Max thrust acceleration in m/s^2 at 100% thrust
export const maxThrustAcceleration = 1_000_000; // ~ 100_000 G

// Rates in radians per second
const lookSpeed = 1.5;
const rotSpeedRoll = 1.0;
const rotSpeedPitch = 0.8;
const rotSpeedYaw = 0.5;

// Max rate at which the ship can reorient itself toward its velocity vector.
const alignToVelocityMaxAngularSpeed = 0.7; // rad/s

/**
 * Update pilot look angles in-place based on input.
 */
export function updatePilotLook(
  dtSeconds: number,
  input: ControlInput,
  lookState: PilotLookState,
): void {
  if (input.lookReset) {
    lookState.azimuth = 0;
    lookState.elevation = 0;
  }

  if (input.lookLeft) lookState.azimuth += lookSpeed * dtSeconds;
  if (input.lookRight) lookState.azimuth -= lookSpeed * dtSeconds;
  if (input.lookUp) lookState.elevation += lookSpeed * dtSeconds;
  if (input.lookDown) lookState.elevation -= lookSpeed * dtSeconds;
}

function rollFrame(
  frame: LocalFrame,
  dtSeconds: number,
  input: ControlInput,
): LocalFrame {
  if (
    (!input.rollLeft && !input.rollRight) ||
    (input.rollLeft && input.rollRight)
  ) {
    return frame;
  }

  const angle = (input.rollLeft ? -1 : 1) * rotSpeedRoll * dtSeconds;

  // Roll around local forward axis (in world coords)
  return rotateFrameAroundAxis(frame, frame.forward, angle);
}

function pitchFrame(
  frame: LocalFrame,
  dtSeconds: number,
  input: ControlInput,
): LocalFrame {
  let pitchInput = 0;
  if (input.pitchDown) pitchInput += 1;
  if (input.pitchUp) pitchInput -= 1;
  if (pitchInput === 0) return frame;

  const angle = pitchInput * rotSpeedPitch * dtSeconds;

  // Pitch around local right axis
  return rotateFrameAroundAxis(frame, frame.right, angle);
}

function yawFrame(
  frame: LocalFrame,
  dtSeconds: number,
  input: ControlInput,
): LocalFrame {
  if (
    (!input.yawLeft && !input.yawRight) ||
    (input.yawLeft && input.yawRight)
  ) {
    return frame;
  }

  const angle = (input.yawLeft ? 1 : -1) * rotSpeedYaw * dtSeconds;

  // Yaw around local up axis
  return rotateFrameAroundAxis(frame, frame.up, angle);
}

/**
 * Update the persistent thrust magnitude in the given ControlState based on
 * numeric-key input.
 *
 * Mapping:
 *   0 -> 0%
 *   1 -> 1%
 *   2 -> 5%
 *   3 -> 25%
 *   4 -> 50%
 *   5 -> 100%
 *
 * If multiple keys are pressed at once, the highest level wins for this frame.
 */
export function updateThrustMagnitudeFromInput(
  input: ControlInput,
  controlState: SimControlState,
): void {
  if (input.thrust6)
    controlState.thrustPercent = 1.0; // 100%
  else if (input.thrust5)
    controlState.thrustPercent = 0.5; // 50%
  else if (input.thrust4)
    controlState.thrustPercent = 0.25; // 25%
  else if (input.thrust3)
    controlState.thrustPercent = 0.05; // 5%
  else if (input.thrust2)
    controlState.thrustPercent = 0.01; // 1%
  else if (input.thrust1)
    controlState.thrustPercent = 0.001; // 0.1%
  else if (input.thrust0) controlState.thrustPercent = 0; // 0%
}

/**
 * Signed thrust percent in [-1, 1]:
 *  - Sign from Space (forward) / B (backward)
 *  - Magnitude from stored thrust level (set by 0–5) in the given state.
 */
export function getSignedThrustPercent(
  input: ControlInput,
  controlState: SimControlState,
): number {
  const mag = controlState.thrustPercent;
  const forward = input.burnForward ? mag : 0;
  const backward = input.burnBackwards ? mag : 0;

  return forward - backward;
}

/**
 * Top-level update for orientation only; does NOT move the body forward.
 * Position integration is handled by gravity/thrust integration.
 *
 * This function updates:
 *  - persistent pilot look angles inside ControlState.look
 *  - alignToVelocity flag inside the ControlState
 *  - the body's LocalFrame based on roll/pitch/yaw input
 *  - the body's LocalFrame when aligning to velocity is requested
 */
function updateBodyOrientationFromInput(
  dtSeconds: number,
  input: ControlInput,
  controlState: SimControlState,
  body: ControlledBodyState,
): void {
  let frame = body.frame;
  frame = rollFrame(frame, dtSeconds, input);
  frame = pitchFrame(frame, dtSeconds, input);
  frame = yawFrame(frame, dtSeconds, input);

  body.frame = frame;

  // Apply alignment toward the velocity vector, if requested.
  updateFrameAlignToVelocity(dtSeconds, input, controlState, body);
}

/**
 * When enabled, gradually rotate the body's frame so that its forward axis
 * aligns with the current velocity direction.
 *
 * Rotation is rate-limited to alignToVelocityMaxAngularSpeed so that the
 * effect feels like small attitude-control thrusters rather than an
 * instantaneous snap.
 */
function updateFrameAlignToVelocity(
  dtSeconds: number,
  input: ControlInput,
  controlState: SimControlState,
  body: ControlledBodyState,
): void {
  // Respect the high-level flag owned by the ControlState so that
  // future logic can gate alignment without depending directly on input.
  const wantAlign = controlState.alignToVelocity && input.alignToVelocity;
  if (!wantAlign) {
    return;
  }

  const v = body.velocity;
  const speed = vec3.length(v);
  if (speed === 0) {
    // No meaningful velocity direction to align to.
    return;
  }

  const targetForward = vec3.scale(v, 1 / speed);
  const currentForward = body.frame.forward;

  // If we're already nearly aligned, do nothing.
  const dot = vec3.dot(currentForward, targetForward);
  const clampedDot = Math.min(1, Math.max(-1, dot));
  const angle = Math.acos(clampedDot);
  if (angle < 1e-4) {
    return;
  }

  // Compute the rotation axis that would take currentForward to targetForward.
  const fullAxis = vec3.cross(currentForward, targetForward);
  const axisLen = vec3.length(fullAxis);
  if (axisLen < 1e-6) {
    // Parallel or anti-parallel: simple axis choice.
    if (clampedDot > 0) {
      // Same direction: nothing to do.
      return;
    }
    // Opposite direction: choose an axis orthogonal to forward.
    const up = body.frame.up;
    const fallbackAxis = vec3.cross(currentForward, up);
    const fallbackLen = vec3.length(fallbackAxis);
    if (fallbackLen < 1e-6) {
      // As a last resort, use the frame's right axis.
      const axis = body.frame.right;
      const maxStep = alignToVelocityMaxAngularSpeed * dtSeconds;
      const stepAngle = Math.min(Math.PI, maxStep);
      body.frame = rotateFrameAroundAxis(body.frame, axis, stepAngle);
      return;
    }

    const axis = vec3.scale(fallbackAxis, 1 / fallbackLen);
    const maxStep = alignToVelocityMaxAngularSpeed * dtSeconds;
    const stepAngle = Math.min(Math.PI, maxStep);
    body.frame = rotateFrameAroundAxis(body.frame, axis, stepAngle);
    return;
  }

  // General case: rotate partially toward the target, clamped by max angular speed.
  const axis = vec3.scale(fullAxis, 1 / axisLen);
  const maxStep = alignToVelocityMaxAngularSpeed * dtSeconds;
  const stepAngle = Math.min(angle, maxStep);

  body.frame = rotateFrameAroundAxis(body.frame, axis, stepAngle);
}

/**
 * Update the persistent "align to velocity" intent in the given ControlState.
 *
 * While the align key is held, the ship's attitude will be steered
 * toward the velocity vector.
 */
export function updateAlignToVelocityFromInput(
  input: ControlInput,
  controlState: SimControlState,
): void {
  controlState.alignToVelocity = input.alignToVelocity;
}

/**
 * Handles control-input-based orientation updates for the controlled ship.
 * Also updates the persistent control state and pilot view look state.
 */
export function updateShipOrientationFromControls(
  dtSeconds: number,
  ship: ShipBody,
  input: ControlInput,
  controlState: SimControlState,
): void {
  const bodyState = {
    frame: ship.frame,
    velocity: ship.velocity,
  };
  updateBodyOrientationFromInput(dtSeconds, input, controlState, bodyState);
  writeBackControlledBodyState(ship, bodyState);
}

function writeBackControlledBodyState(
  ship: ShipBody,
  body: ControlledBodyState,
): void {
  ship.frame = body.frame;
  ship.velocity = body.velocity;
}
