import type {
  AttitudeCommand,
  ControlInput,
  ControlledBodyState,
  PropulsionCommand,
  RcsCommand,
  SimControlState,
  ThrustCommand,
} from "../../app/controlPorts";
import type { ControlPlugin } from "../../app/pluginPorts";
import type { World } from "../../domain/domainPorts";

// Max main-engine thrust acceleration in m/s^2 at 100% thrust
export const maxThrustAcceleration = 1_000_000; // ~ 100_000 G
// Max RCS translation acceleration in m/s^2 (independent of thrust level).
export const maxRcsTranslationAcceleration = 20_000; // ~ 2_000 G

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

export function updateControlState(
  controlInput: ControlInput,
  controlState: SimControlState,
  controlPlugins: ControlPlugin[] = [],
): void {
  updateThrustLevelFromInput(controlInput, controlState);
  for (const plugin of controlPlugins) {
    plugin.updateControlState?.({ controlInput, controlState });
  }
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
 *  - Magnitude from stored thrust level (set by 0-9) in the given state.
 */
export function getMainThrustCommandInto(
  into: ThrustCommand,
  controlInput: ControlInput,
  controlState: SimControlState,
): void {
  const mag = shipThrustValues[controlState.thrustLevel];
  const forward = controlInput.burnForward ? mag : 0;
  const backward = controlInput.burnBackwards ? mag : 0;
  into.forward = forward - backward;
}

/**
 * Signed RCS translation command in [-1, 1] for N/M lateral burns.
 */
export function getRcsCommandInto(
  into: RcsCommand,
  controlInput: ControlInput,
): void {
  if (controlInput.burnLeft === controlInput.burnRight) {
    into.right = 0;
  } else {
    into.right = controlInput.burnRight ? 1 : -1;
  }
}

/**
 * Top-level update for attitude control only; does NOT rotate the body.
 * Rotation integration is handled separately via angular velocity.
 *
 * This function updates the ship's angular velocity based on:
 *  - roll/pitch/yaw input, or
 *  - plugin-provided attitude commands
 */
export function updateControlledBodyAngularVelocityFromInput(
  dtMillis: number,
  ship: ControlledBodyState,
  controlInput: ControlInput,
  controlState: SimControlState,
  world: World,
  controlPlugins: ControlPlugin[] = [],
): void {
  const manualCommand = getManualAttitudeCommand(controlInput);
  const command = getPluginAttitudeCommand(
    dtMillis,
    ship,
    controlInput,
    controlState,
    world,
    controlPlugins,
  );

  applyAttitudeCommand(dtMillis, ship, command ?? manualCommand);
}

export function resolvePropulsionCommandWithPlugins(
  dtMillis: number,
  controlInput: ControlInput,
  ship: ControlledBodyState,
  world: World,
  manualPropulsion: PropulsionCommand,
  maxThrustAcceleration: number,
  maxRcsTranslationAcceleration: number,
  controlPlugins: ControlPlugin[] = [],
): PropulsionCommand {
  let command = manualPropulsion;
  for (const plugin of controlPlugins) {
    if (!plugin.resolvePropulsionCommand) continue;
    command = plugin.resolvePropulsionCommand({
      dtMillis,
      controlInput,
      controlledBody: ship,
      ship,
      world,
      manualPropulsion: command,
      maxThrustAcceleration,
      maxRcsTranslationAcceleration,
    });
  }
  return command;
}

function getPluginAttitudeCommand(
  dtMillis: number,
  ship: ControlledBodyState,
  controlInput: ControlInput,
  controlState: SimControlState,
  world: World,
  controlPlugins: ControlPlugin[],
): AttitudeCommand | null {
  for (const plugin of controlPlugins) {
    if (!plugin.getAttitudeCommand) continue;
    const command = plugin.getAttitudeCommand({
      dtMillis,
      controlledBody: ship,
      ship,
      controlInput,
      controlState,
      world,
    });
    if (command) {
      return command;
    }
  }
  return null;
}
