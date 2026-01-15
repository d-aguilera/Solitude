import {
  lookSpeed,
  rotSpeedRoll,
  rotSpeedPitch,
  rotSpeedYaw,
} from "./controlsConfig.js";
import { rotateFrameAroundAxis } from "../world/localFrame.js";
import { vec } from "../world/vec3.js";
import { LocalFrame, Vec3 } from "../world/domain.js";

// Max thrust acceleration in m/s^2 at 100% thrust
const maxThrustAcceleration = 1_000_000; // ~ 100_000 G

export interface ControlInput {
  rollLeft: boolean;
  rollRight: boolean;
  pitchUp: boolean;
  pitchDown: boolean;
  yawLeft: boolean;
  yawRight: boolean;
  lookLeft: boolean;
  lookRight: boolean;
  lookUp: boolean;
  lookDown: boolean;
  lookReset: boolean;
  camForward: boolean;
  camBackward: boolean;
  camUp: boolean;
  camDown: boolean;
  // thrust
  burnForward: boolean;
  burnBackwards: boolean;
  thrust0: boolean;
  thrust1: boolean;
  thrust2: boolean;
  thrust3: boolean;
  thrust4: boolean;
  thrust5: boolean;
}

/**
 * Pilot's view state relative to the controlled vehicle.
 */
export interface PilotLookState {
  azimuth: number;
  elevation: number;
}

/**
 * Per-player control state that must persist across frames.
 */
export interface ControlState {
  /**
   * Persistent thrust magnitude in [0..1], updated by numeric keys.
   */
  thrustPercent: number;

  /**
   * Persistent pilot look state owned by the controls layer.
   */
  look: PilotLookState;
}

/**
 * Simple container for the controlled body's pose and velocity.
 * Kept separate from the broader WorldState.
 */
export interface ControlledBodyState {
  frame: LocalFrame;
  velocity: Vec3;
}

/**
 * Create a default-initialized control state.
 * Call this once at game setup and then keep mutating the same instance.
 */
export function createInitialControlState(): ControlState {
  return {
    thrustPercent: 0,
    look: {
      azimuth: 0,
      elevation: 0,
    },
  };
}

/**
 * Update pilot look angles in-place based on input.
 */
export function updatePilotLook(
  dtSeconds: number,
  input: ControlInput,
  lookState: PilotLookState
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
  input: ControlInput
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
  input: ControlInput
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
  input: ControlInput
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
  state: ControlState
): void {
  if (input.thrust5) state.thrustPercent = 1.0; // 100%
  else if (input.thrust4) state.thrustPercent = 0.5; // 50%
  else if (input.thrust3) state.thrustPercent = 0.25; // 25%
  else if (input.thrust2) state.thrustPercent = 0.05; // 5%
  else if (input.thrust1) state.thrustPercent = 0.01; // 1%
  else if (input.thrust0) state.thrustPercent = 0; // 0%
}

/**
 * Compute unsigned thrust magnitude [0..1] from the current control state.
 * Kept as a named helper to document the contract and allow future
 * extensions (e.g. clamping, non-linear curves).
 */
export function getThrustMagnitudePercentFromState(
  state: ControlState
): number {
  return state.thrustPercent;
}

/**
 * Signed thrust percent in [-1, 1]:
 *  - Sign from Space (forward) / B (backward)
 *  - Magnitude from stored thrust level (set by 0–5) in the given state.
 */
export function getSignedThrustPercent(
  input: ControlInput,
  state: ControlState
): number {
  const mag = getThrustMagnitudePercentFromState(state);

  const forward = input.burnForward;
  const backward = input.burnBackwards;
  if (forward && backward) return 0;
  if (forward) return mag;
  if (backward) return -mag;

  return 0;
}

/**
 * Apply thrust acceleration to the controlled body's velocity when burn/brake
 * are active. Acceleration magnitude is:
 *
 *   a = maxThrustAcceleration * thrustPercent
 *
 * where thrustPercent ∈ [-1, 1] and is chosen from discrete levels
 * depending on Space/B and numeric thrust keys.
 */
export function applyThrustToVelocity(
  dtSeconds: number,
  input: ControlInput,
  controlState: ControlState,
  body: ControlledBodyState
): void {
  if (dtSeconds <= 0) return;

  const thrustPercent = getSignedThrustPercent(input, controlState);
  if (thrustPercent === 0) return;

  const f = body.frame.forward;
  const accelMagnitude = maxThrustAcceleration * thrustPercent;

  const dv = vec.scale(f, accelMagnitude * dtSeconds);
  body.velocity.x += dv.x;
  body.velocity.y += dv.y;
  body.velocity.z += dv.z;
}

/**
 * Top-level update for orientation only; does NOT move the body forward.
 * Position integration is handled by gravity/thrust integration.
 *
 * This function updates:
 *  - thrustPercent in the given ControlState
 *  - persistent pilot look angles inside ControlState.look
 *  - the body's LocalFrame based on roll/pitch/yaw input
 */
export function updateBodyOrientationFromInput(
  dtSeconds: number,
  input: ControlInput,
  controlState: ControlState,
  body: ControlledBodyState
): void {
  // Update thrust level before we use it anywhere.
  updateThrustMagnitudeFromInput(input, controlState);

  // Update persistent pilot look state owned by the controls.
  updatePilotLook(dtSeconds, input, controlState.look);

  let frame = body.frame;
  frame = rollFrame(frame, dtSeconds, input);
  frame = pitchFrame(frame, dtSeconds, input);
  frame = yawFrame(frame, dtSeconds, input);

  body.frame = frame;
}
