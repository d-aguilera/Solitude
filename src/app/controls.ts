import type { LocalFrame, ShipBody, Vec3 } from "../domain/domainPorts.js";
import { rotateFrameAroundAxis } from "../domain/localFrame.js";
import { vec3 } from "../domain/vec3.js";
import type { ControlledBodyState, SimControlState } from "./appInternals.js";
import type { ControlInput, PilotLookState } from "./appPorts.js";

// Max thrust acceleration in m/s^2 at 100% thrust
export const maxThrustAcceleration = 1_000_000; // ~ 100_000 G

// Rates in radians per second
const lookSpeed = 1.5;
const rotSpeedRoll = 1.0;
const rotSpeedPitch = 0.8;
const rotSpeedYaw = 0.5;

// Max rate at which the ship can reorient itself toward its velocity vector.
const alignToVelocityMaxAngularSpeed = 0.7; // rad/s

const shipThrustExponent = 3; // [0..9] ^ 3
const shipThrustMaxPow = Math.pow(9, shipThrustExponent);
const shipThrustValues = Array.from<number, number>(
  { length: 10 },
  (_, i) => Math.pow(i, shipThrustExponent) / shipThrustMaxPow,
);

export function updateControlState(
  controlInput: ControlInput,
  controlState: SimControlState,
): number {
  updateThrustLevelFromInput(controlInput, controlState);
  updateAlignToVelocityFromInput(controlInput, controlState);
  return getSignedThrustPercent(controlInput, controlState);
}

/**
 * Update pilot look angles in-place based on input.
 */
export function updatePilotLook(
  dtSeconds: number,
  controlInput: ControlInput,
  lookState: PilotLookState,
): void {
  if (controlInput.lookReset) {
    lookState.azimuth = 0;
    lookState.elevation = 0;
  }

  if (controlInput.lookLeft) lookState.azimuth += lookSpeed * dtSeconds;
  if (controlInput.lookRight) lookState.azimuth -= lookSpeed * dtSeconds;
  if (controlInput.lookUp) lookState.elevation += lookSpeed * dtSeconds;
  if (controlInput.lookDown) lookState.elevation -= lookSpeed * dtSeconds;
}

function rollFrame(
  frame: LocalFrame,
  dtSeconds: number,
  controlInput: ControlInput,
): LocalFrame {
  if (
    (!controlInput.rollLeft && !controlInput.rollRight) ||
    (controlInput.rollLeft && controlInput.rollRight)
  ) {
    return frame;
  }

  const angle = (controlInput.rollLeft ? -1 : 1) * rotSpeedRoll * dtSeconds;

  // Roll around local forward axis (in world coords)
  return rotateFrameAroundAxis(frame, frame.forward, angle);
}

function pitchFrame(
  frame: LocalFrame,
  dtSeconds: number,
  controlInput: ControlInput,
): LocalFrame {
  let pitchInput = 0;
  if (controlInput.pitchDown) pitchInput += 1;
  if (controlInput.pitchUp) pitchInput -= 1;
  if (pitchInput === 0) return frame;

  const angle = pitchInput * rotSpeedPitch * dtSeconds;

  // Pitch around local right axis
  return rotateFrameAroundAxis(frame, frame.right, angle);
}

function yawFrame(
  frame: LocalFrame,
  dtSeconds: number,
  controlInput: ControlInput,
): LocalFrame {
  if (
    (!controlInput.yawLeft && !controlInput.yawRight) ||
    (controlInput.yawLeft && controlInput.yawRight)
  ) {
    return frame;
  }

  const angle = (controlInput.yawLeft ? 1 : -1) * rotSpeedYaw * dtSeconds;

  // Yaw around local up axis
  return rotateFrameAroundAxis(frame, frame.up, angle);
}

const thrustKeys: (keyof ControlInput)[] = [
  "thrust0",
  "thrust1",
  "thrust2",
  "thrust3",
  "thrust4",
  "thrust5",
  "thrust6",
  "thrust7",
  "thrust8",
  "thrust9",
];

/**
 * Update the persistent thrust magnitude in the given ControlState based on
 * numeric-key input.
 *
 * If multiple keys are pressed at once, the highest level wins for this frame.
 */
function updateThrustLevelFromInput(
  controlInput: ControlInput,
  controlState: SimControlState,
): void {
  for (let i = 9; i >= 0; i--) {
    if (controlInput[thrustKeys[i]]) {
      controlState.thrustLevel = i;
      break;
    }
  }
}

/**
 * Signed thrust percent in [-1, 1]:
 *  - Sign from Space (forward) / B (backward)
 *  - Magnitude from stored thrust level (set by 0–5) in the given state.
 */
function getSignedThrustPercent(
  controlInput: ControlInput,
  controlState: SimControlState,
): number {
  const mag = shipThrustValues[controlState.thrustLevel];
  const forward = controlInput.burnForward ? mag : 0;
  const backward = controlInput.burnBackwards ? mag : 0;

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
  controlInput: ControlInput,
  controlState: SimControlState,
  body: ControlledBodyState,
): void {
  let frame = body.frame;
  frame = rollFrame(frame, dtSeconds, controlInput);
  frame = pitchFrame(frame, dtSeconds, controlInput);
  frame = yawFrame(frame, dtSeconds, controlInput);

  body.frame = frame;

  // Apply alignment toward the velocity vector, if requested.
  updateFrameAlignToVelocity(dtSeconds, controlInput, controlState, body);
}

const targetForwardScratch: Vec3 = vec3.zero();
const fullAxisScratch: Vec3 = vec3.zero();
const fallbackAxisScratch: Vec3 = vec3.zero();
const axisScratch: Vec3 = vec3.zero();

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
  controlInput: ControlInput,
  controlState: SimControlState,
  body: ControlledBodyState,
): void {
  // Respect the high-level flag owned by the ControlState so that
  // future logic can gate alignment without depending directly on input.
  const wantAlign =
    controlState.alignToVelocity && controlInput.alignToVelocity;
  if (!wantAlign) {
    return;
  }

  const v = body.velocity;
  const speed = vec3.length(v);
  if (speed === 0) {
    // No meaningful velocity direction to align to.
    return;
  }

  // targetForward = v / speed
  vec3.scaleInto(targetForwardScratch, 1 / speed, v);
  const targetForward = targetForwardScratch;
  const currentForward = body.frame.forward;

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
    const up = body.frame.up;
    vec3.crossInto(fallbackAxisScratch, currentForward, up);
    const fallbackAxis = fallbackAxisScratch;
    const fallbackLen = vec3.length(fallbackAxis);
    if (fallbackLen < 1e-6) {
      // As a last resort, use the frame's right axis.
      const axis = body.frame.right;
      const maxStep = alignToVelocityMaxAngularSpeed * dtSeconds;
      const stepAngle = Math.min(Math.PI, maxStep);
      body.frame = rotateFrameAroundAxis(body.frame, axis, stepAngle);
      return;
    }

    vec3.scaleInto(axisScratch, 1 / fallbackLen, fallbackAxis);
    const axis = axisScratch;
    const maxStep = alignToVelocityMaxAngularSpeed * dtSeconds;
    const stepAngle = Math.min(Math.PI, maxStep);
    body.frame = rotateFrameAroundAxis(body.frame, axis, stepAngle);
    return;
  }

  // General case: rotate partially toward the target, clamped by max angular speed.
  vec3.scaleInto(axisScratch, 1 / axisLen, fullAxis);
  const axis = axisScratch;
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
function updateAlignToVelocityFromInput(
  controlInput: ControlInput,
  controlState: SimControlState,
): void {
  controlState.alignToVelocity = controlInput.alignToVelocity;
}

/**
 * Handles control-input-based orientation updates for the controlled ship.
 * Also updates the persistent control state and pilot view look state.
 */
export function updateShipOrientationFromControls(
  dtSeconds: number,
  ship: ShipBody,
  controlInput: ControlInput,
  controlState: SimControlState,
): void {
  const bodyState = {
    frame: ship.frame,
    velocity: ship.velocity,
  };
  updateBodyOrientationFromInput(
    dtSeconds,
    controlInput,
    controlState,
    bodyState,
  );
  writeBackControlledBodyState(ship, bodyState);
}

function writeBackControlledBodyState(
  ship: ShipBody,
  body: ControlledBodyState,
): void {
  ship.frame = body.frame;
  ship.velocity = body.velocity;
}
