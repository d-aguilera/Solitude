import type { World } from "../domain/domainPorts.js";
import { type LocalFrame, localFrame } from "../domain/localFrame.js";
import type { ControlledBodyState, SimControlState } from "./appInternals.js";
import {
  alignFrameToDirection,
  applyCircleNowOrientation,
  getDominantBodyDirection,
  getVelocityDirection,
} from "./autoPilot.js";
import type { ControlInput } from "./controlPorts.js";
import type { PilotLookState } from "./scenePorts.js";

// Max thrust acceleration in m/s^2 at 100% thrust
export const maxThrustAcceleration = 1_000_000; // ~ 100_000 G

// Rates in radians per second
const lookSpeed = 0.0015;
const rotSpeedRoll = 0.001;
const rotSpeedPitch = 0.0008;
const rotSpeedYaw = 0.0005;

const shipThrustExponent = 3; // [0..9] ^ 3
const shipThrustMaxPow = Math.pow(9, shipThrustExponent);
const shipThrustValues = Array.from<number, number>(
  { length: 10 },
  (_, i) => Math.pow(i, shipThrustExponent) / shipThrustMaxPow,
);

export function getThrustPercentForLevel(thrustLevel: number): number {
  const clamped = Math.min(9, Math.max(0, Math.floor(thrustLevel)));
  return shipThrustValues[clamped];
}

export interface ThrustCommand {
  forward: number;
  right: number;
}

export function updateControlState(
  controlInput: ControlInput,
  controlState: SimControlState,
): ThrustCommand {
  updateThrustLevelFromInput(controlInput, controlState);
  controlState.alignToVelocity = controlInput.alignToVelocity;
  controlState.alignToBody = controlInput.alignToBody;
  return getThrustCommand(controlInput, controlState);
}

/**
 * Update pilot look angles in-place based on input.
 */
export function updatePilotLook(
  dtMillis: number,
  controlInput: ControlInput,
  lookState: PilotLookState,
): void {
  if (controlInput.lookReset) {
    lookState.azimuth = 0;
    lookState.elevation = 0;
  }

  if (controlInput.lookLeft) lookState.azimuth += lookSpeed * dtMillis;
  if (controlInput.lookRight) lookState.azimuth -= lookSpeed * dtMillis;
  if (controlInput.lookUp) lookState.elevation += lookSpeed * dtMillis;
  if (controlInput.lookDown) lookState.elevation -= lookSpeed * dtMillis;
}

function rollFrame(
  frame: LocalFrame,
  dtMillis: number,
  controlInput: ControlInput,
): void {
  if (
    (!controlInput.rollLeft && !controlInput.rollRight) ||
    (controlInput.rollLeft && controlInput.rollRight)
  ) {
    return;
  }

  const angle = (controlInput.rollLeft ? -1 : 1) * rotSpeedRoll * dtMillis;

  // Roll around local forward axis (in world coords)
  localFrame.rotateAroundAxisInPlace(frame, frame.forward, angle);
}

function pitchFrame(
  frame: LocalFrame,
  dtMillis: number,
  controlInput: ControlInput,
): void {
  let pitchInput = 0;
  if (controlInput.pitchDown) pitchInput += 1;
  if (controlInput.pitchUp) pitchInput -= 1;
  if (pitchInput === 0) return;

  const angle = pitchInput * rotSpeedPitch * dtMillis;

  // Pitch around local right axis
  localFrame.rotateAroundAxisInPlace(frame, frame.right, angle);
}

function yawFrame(
  frame: LocalFrame,
  dtMillis: number,
  controlInput: ControlInput,
): void {
  if (
    (!controlInput.yawLeft && !controlInput.yawRight) ||
    (controlInput.yawLeft && controlInput.yawRight)
  ) {
    return;
  }

  const angle = (controlInput.yawLeft ? 1 : -1) * rotSpeedYaw * dtMillis;

  // Yaw around local up axis
  localFrame.rotateAroundAxisInPlace(frame, frame.up, angle);
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
function getThrustCommand(
  controlInput: ControlInput,
  controlState: SimControlState,
): ThrustCommand {
  const { burnBackwards, burnForward, burnLeft, burnRight } = controlInput;
  const mag = shipThrustValues[controlState.thrustLevel];
  const forward = burnForward ? mag : 0;
  const backward = burnBackwards ? mag : 0;
  const left = burnLeft ? mag : 0;
  const right = burnRight ? mag : 0;

  return {
    forward: forward - backward,
    right: right - left,
  };
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
export function updateShipOrientationFromInput(
  dtMillis: number,
  ship: ControlledBodyState,
  controlInput: ControlInput,
  controlState: SimControlState,
  world: World,
): void {
  const { frame, orientation } = ship;
  rollFrame(frame, dtMillis, controlInput);
  pitchFrame(frame, dtMillis, controlInput);
  yawFrame(frame, dtMillis, controlInput);

  // Update the body's orientation based on the new frame.
  localFrame.intoMat3(orientation, frame);

  // Apply alignment if requested.
  if (controlState.alignToBody && controlInput.alignToBody) {
    const direction = getDominantBodyDirection(ship, world);
    if (direction) {
      alignFrameToDirection(dtMillis, ship, direction);
    }
  } else if (controlState.alignToVelocity && controlInput.alignToVelocity) {
    const direction = getVelocityDirection(ship);
    if (direction) {
      alignFrameToDirection(dtMillis, ship, direction);
    }
  }

  if (controlInput.circleNow) {
    if (applyCircleNowOrientation(dtMillis, ship, world)) {
      localFrame.intoMat3(orientation, frame);
    }
  }
}
