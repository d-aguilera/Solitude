import type {
  ExternalAttitudeCommand,
  ExternalControlPlugin,
  ExternalMutableControlState,
} from "@solitude/plugin-api/controls";
import type { ExternalControlInput } from "@solitude/plugin-api/input";
import type {
  ExternalSpacecraftPropulsionCommand,
  ExternalSpacecraftPropulsionResolver,
  ExternalSpacecraftRcsCommand,
  ExternalSpacecraftThrustCommand,
} from "@solitude/plugin-api/spacecraft";
import type {
  ExternalControlledBody,
  ExternalWorld,
} from "@solitude/plugin-api/world";

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

export interface SpacecraftControlState extends ExternalMutableControlState {
  thrustLevel: number;
}

export function updateControlState(
  controlInput: ExternalControlInput,
  controlState: SpacecraftControlState,
  controlPlugins: readonly ExternalControlPlugin[] = [],
): void {
  updateThrustLevelFromInput(controlInput, controlState);
  for (const plugin of controlPlugins) {
    plugin.updateControlState?.({ controlInput, controlState });
  }
}

function getManualAttitudeCommand(
  controlInput: ExternalControlInput,
): ExternalAttitudeCommand {
  const rollLeft = Boolean(controlInput.rollLeft);
  const rollRight = Boolean(controlInput.rollRight);
  const pitchDown = Boolean(controlInput.pitchDown);
  const pitchUp = Boolean(controlInput.pitchUp);
  const yawLeft = Boolean(controlInput.yawLeft);
  const yawRight = Boolean(controlInput.yawRight);

  let rollInput = 0;
  if (rollLeft !== rollRight) {
    rollInput = rollLeft ? -1 : 1;
  }

  let pitchInput = 0;
  if (pitchDown) pitchInput += 1;
  if (pitchUp) pitchInput -= 1;

  let yawInput = 0;
  if (yawLeft !== yawRight) {
    yawInput = yawLeft ? 1 : -1;
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
  ship: ExternalControlledBody,
  command: ExternalAttitudeCommand,
): void {
  const dtSec = dtMillis / 1000;
  if (dtSec <= 0) return;

  const maxDelta = maxAngularAccel * dtSec;
  const omega = ship.angularVelocity;
  omega.roll = stepToward(omega.roll, command.roll, maxDelta);
  omega.pitch = stepToward(omega.pitch, command.pitch, maxDelta);
  omega.yaw = stepToward(omega.yaw, command.yaw, maxDelta);
}

const thrustKeys: (keyof ExternalControlInput)[] = [
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
  controlInput: ExternalControlInput,
  controlState: SpacecraftControlState,
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
  into: ExternalSpacecraftThrustCommand,
  controlInput: ExternalControlInput,
  controlState: SpacecraftControlState,
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
  into: ExternalSpacecraftRcsCommand,
  controlInput: ExternalControlInput,
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
  ship: ExternalControlledBody,
  controlInput: ExternalControlInput,
  controlState: SpacecraftControlState,
  world: ExternalWorld,
  controlPlugins: readonly ExternalControlPlugin[] = [],
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
  controlInput: ExternalControlInput,
  ship: ExternalControlledBody,
  world: ExternalWorld,
  manualPropulsion: ExternalSpacecraftPropulsionCommand,
  maxThrustAcceleration: number,
  maxRcsTranslationAcceleration: number,
  propulsionResolvers: readonly ExternalSpacecraftPropulsionResolver[] = [],
): ExternalSpacecraftPropulsionCommand {
  let command = manualPropulsion;
  for (const resolver of propulsionResolvers) {
    command = resolver.resolvePropulsionCommand({
      dtMillis,
      controlInput,
      controlledBody: ship,
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
  ship: ExternalControlledBody,
  controlInput: ExternalControlInput,
  controlState: SpacecraftControlState,
  world: ExternalWorld,
  controlPlugins: readonly ExternalControlPlugin[],
): ExternalAttitudeCommand | null {
  for (const plugin of controlPlugins) {
    if (!plugin.getAttitudeCommand) continue;
    const command = plugin.getAttitudeCommand({
      dtMillis,
      controlledBody: ship,
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
