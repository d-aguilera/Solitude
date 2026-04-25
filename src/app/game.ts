import { resolveCollisions } from "../domain/collisions";
import type { GravityEngine, World } from "../domain/domainPorts";
import { buildInitialGravityState } from "../domain/gravityState";
import type {
  ControlInput,
  ControlledBodyState,
  PropulsionCommand,
  RcsCommand,
  SimControlState,
  ThrustCommand,
} from "./controlPorts";
import {
  getMainThrustCommandInto,
  getRcsCommandInto,
  maxRcsTranslationAcceleration,
  maxThrustAcceleration,
  resolvePropulsionCommandWithPlugins,
  updateControlState,
  updateShipAngularVelocityFromInput,
} from "./controls";
import {
  applyCelestialSpin,
  applyGravity,
  applyRcsTranslation,
  applyShipRotation,
  applyThrust,
} from "./physics";
import type { ControlPlugin } from "./pluginPorts";
import type {
  TickCallback,
  TickOutput,
  TickParams,
  WorldAndScene,
} from "./runtimePorts";

/**
 * App‑core game entry.
 */
export function createTickHandler(
  gravityEngine: GravityEngine,
  thrustLevel: number,
  worldAndScene: WorldAndScene,
  controlPlugins: ControlPlugin[] = [],
): TickCallback {
  let propulsionCommand: PropulsionCommand;

  const simControlState: SimControlState = {
    thrustLevel,
  };

  const gravityState = buildInitialGravityState(worldAndScene.world);

  /**
   * Per‑frame update/render entry called by the game loop.
   */
  return (output: TickOutput, params: TickParams): void => {
    const { controlInput, dtMillis, dtMillisSim } = params;

    propulsionCommand = getPropulsionCommandForTick(
      dtMillis,
      controlInput,
      simControlState,
      worldAndScene.mainShip,
      worldAndScene.world,
      controlPlugins,
    );
    updateShipAngularVelocityFromInput(
      dtMillis,
      worldAndScene.mainShip,
      controlInput,
      simControlState,
      worldAndScene.world,
      controlPlugins,
    );
    applyShipRotation(dtMillis, worldAndScene.mainShip);
    applyThrust(dtMillis, worldAndScene.mainShip, propulsionCommand.main);
    applyRcsTranslation(
      dtMillis,
      worldAndScene.mainShip,
      propulsionCommand.rcs,
    );

    applyGravity(dtMillisSim, gravityEngine, gravityState);

    resolveCollisions(worldAndScene.world);

    applyCelestialSpin(dtMillisSim, worldAndScene.world);

    output.currentThrustLevel = getRenderedThrustLevel(
      propulsionCommand.main,
      simControlState,
    );

    output.currentRcsLevel = getRenderedRcsLevel(propulsionCommand.rcs);
  };
}

let manualPropulsionCommand: PropulsionCommand = {
  main: { forward: 0 },
  rcs: { right: 0 },
};

function getPropulsionCommandForTick(
  dtMillis: number,
  controlInput: ControlInput,
  controlState: SimControlState,
  ship: ControlledBodyState,
  world: World,
  controlPlugins: ControlPlugin[],
): PropulsionCommand {
  updateControlState(controlInput, controlState, controlPlugins);
  getMainThrustCommandInto(
    manualPropulsionCommand.main,
    controlInput,
    controlState,
  );
  getRcsCommandInto(manualPropulsionCommand.rcs, controlInput);
  return resolvePropulsionCommandWithPlugins(
    dtMillis,
    controlInput,
    ship,
    world,
    manualPropulsionCommand,
    maxThrustAcceleration,
    maxRcsTranslationAcceleration,
    controlPlugins,
  );
}

function getRenderedThrustLevel(
  thrustCommand: ThrustCommand,
  controlState: SimControlState,
): number {
  if (thrustCommand.forward === 0) {
    return 0;
  }
  return thrustCommand.forward > 0
    ? controlState.thrustLevel
    : -controlState.thrustLevel;
}

function getRenderedRcsLevel(rcsCommand: RcsCommand): number {
  if (rcsCommand.right === 0) {
    return 0;
  }
  return rcsCommand.right;
}
