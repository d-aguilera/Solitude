import type { World } from "../domain/domainPorts.js";
import type {
  AttitudeCommand,
  ControlledBodyState,
  SimControlState,
} from "./appInternals.js";
import {
  computeAlignToDirectionCommand,
  computeCircleNowAttitudeCommand,
  getDominantBodyDirection,
  getVelocityDirection,
} from "./autoPilot.js";
import type { ControlInput } from "./controlPorts.js";
import type { PilotLookState } from "./scenePorts.js";

// Max main-engine thrust acceleration in m/s^2 at 100% thrust
export const maxThrustAcceleration = 1_000_000; // ~ 100_000 G
// Max RCS translation acceleration in m/s^2 (independent of thrust level).
export const maxRcsTranslationAcceleration = 20_000; // ~ 2_000 G

// Pilot look rates are in radians per millisecond.
const lookSpeed = 0.0015;

// Ship attitude rates (rad/s) and acceleration (rad/s^2).
const maxRollRate = 1.0;
const maxPitchRate = 0.8;
const maxYawRate = 0.5;
const maxAngularAccel = 4.0;

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
  /** Signed main-engine thrust percent in [-1, 1]. */
  forward: number;
}

export interface RcsCommand {
  /** Signed RCS translation command in [-1, 1] along the ship-right axis. */
  right: number;
}

export interface PropulsionCommand {
  main: ThrustCommand;
  rcs: RcsCommand;
}

export function updateControlState(
  controlInput: ControlInput,
  controlState: SimControlState,
): void {
  updateThrustLevelFromInput(controlInput, controlState);
  controlState.alignToVelocity = controlInput.alignToVelocity;
  controlState.alignToBody = controlInput.alignToBody;
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

function getManualAttitudeCommand(controlInput: ControlInput): AttitudeCommand {
  let rollInput = 0;
  if (controlInput.rollLeft !== controlInput.rollRight) {
    rollInput = controlInput.rollLeft ? -1 : 1;
  }

  let pitchInput = 0;
  if (controlInput.pitchDown) pitchInput += 1;
  if (controlInput.pitchUp) pitchInput -= 1;

  let yawInput = 0;
  if (controlInput.yawLeft !== controlInput.yawRight) {
    yawInput = controlInput.yawLeft ? 1 : -1;
  }

  return {
    roll: rollInput * maxRollRate,
    pitch: pitchInput * maxPitchRate,
    yaw: yawInput * maxYawRate,
  };
}

function stepToward(current: number, target: number, maxDelta: number): number {
  const delta = target - current;
  if (delta > maxDelta) return current + maxDelta;
  if (delta < -maxDelta) return current - maxDelta;
  return target;
}

function applyAttitudeCommand(
  dtMillis: number,
  ship: ControlledBodyState,
  command: AttitudeCommand,
): void {
  const dtSec = dtMillis / 1000;
  if (dtSec <= 0) return;

  const maxDelta = maxAngularAccel * dtSec;
  const omega = ship.angularVelocity;
  omega.roll = stepToward(omega.roll, command.roll, maxDelta);
  omega.pitch = stepToward(omega.pitch, command.pitch, maxDelta);
  omega.yaw = stepToward(omega.yaw, command.yaw, maxDelta);
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
 * Signed main-engine thrust percent in [-1, 1]:
 *  - Sign from Space (forward) / B (backward)
 *  - Magnitude from stored thrust level (set by 0–9) in the given state.
 */
export function getMainThrustCommand(
  controlInput: ControlInput,
  controlState: SimControlState,
): ThrustCommand {
  const { burnBackwards, burnForward } = controlInput;
  const mag = shipThrustValues[controlState.thrustLevel];
  const forward = burnForward ? mag : 0;
  const backward = burnBackwards ? mag : 0;

  return { forward: forward - backward };
}

/**
 * Signed RCS translation command in [-1, 1] for N/M lateral burns.
 */
export function getRcsCommand(controlInput: ControlInput): RcsCommand {
  const { burnLeft, burnRight } = controlInput;
  if (burnLeft === burnRight) {
    return { right: 0 };
  }
  return { right: burnRight ? 1 : -1 };
}

/**
 * Top-level update for attitude control only; does NOT rotate the body.
 * Rotation integration is handled separately via angular velocity.
 *
 * This function updates the ship's angular velocity based on:
 *  - roll/pitch/yaw input, or
 *  - autopilot alignment commands
 */
export function updateShipAngularVelocityFromInput(
  dtMillis: number,
  ship: ControlledBodyState,
  controlInput: ControlInput,
  controlState: SimControlState,
  world: World,
): void {
  const manualCommand = getManualAttitudeCommand(controlInput);
  let command: AttitudeCommand | null = null;

  if (controlInput.circleNow) {
    command = computeCircleNowAttitudeCommand(dtMillis, ship, world);
  }

  if (!command) {
    if (controlState.alignToBody && controlInput.alignToBody) {
      const direction = getDominantBodyDirection(ship, world);
      if (direction) {
        command = computeAlignToDirectionCommand(dtMillis, ship, direction);
      }
    } else if (controlState.alignToVelocity && controlInput.alignToVelocity) {
      const direction = getVelocityDirection(ship);
      if (direction) {
        command = computeAlignToDirectionCommand(dtMillis, ship, direction);
      }
    }
  }

  applyAttitudeCommand(dtMillis, ship, command ?? manualCommand);
}
