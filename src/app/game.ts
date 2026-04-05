import { resolveCollisions } from "../domain/collisions.js";
import type { GravityEngine, World } from "../domain/domainPorts.js";
import { buildInitialGravityState } from "../domain/gravityState.js";
import type { ControlledBodyState, SimControlState } from "./appInternals.js";
import type { ControlInput } from "./controlPorts.js";
import type {
  PropulsionCommand,
  RcsCommand,
  ThrustCommand,
} from "./controls.js";
import {
  getMainThrustCommand,
  getRcsCommand,
  maxRcsTranslationAcceleration,
  maxThrustAcceleration,
  resolvePropulsionCommandWithPlugins,
  updateControlState,
  updateShipAngularVelocityFromInput,
} from "./controls.js";
import {
  applyCelestialSpin,
  applyGravity,
  applyRcsTranslation,
  applyShipRotation,
  applyThrust,
} from "./physics.js";
import type { ControlPlugin } from "./pluginPorts.js";
import type {
  TickCallback,
  TickOutput,
  TickParams,
  WorldAndScene,
} from "./runtimePorts.js";

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

function getPropulsionCommandForTick(
  dtMillis: number,
  controlInput: ControlInput,
  controlState: SimControlState,
  ship: ControlledBodyState,
  world: World,
  controlPlugins: ControlPlugin[],
): PropulsionCommand {
  updateControlState(controlInput, controlState, controlPlugins);
  const manualMain = getMainThrustCommand(controlInput, controlState);
  const manualRcs = getRcsCommand(controlInput);
  return resolvePropulsionCommandWithPlugins(
    dtMillis,
    controlInput,
    ship,
    world,
    { main: manualMain, rcs: manualRcs },
    maxThrustAcceleration,
    maxRcsTranslationAcceleration,
    controlPlugins,
  );
}

function getRenderedThrustLevel(
  thrustCommand: ThrustCommand,
  controlState: SimControlState,
): number {
  const { forward } = thrustCommand;
  if (forward === 0) {
    return 0;
  }
  return forward > 0 ? controlState.thrustLevel : -controlState.thrustLevel;
}

function getRenderedRcsLevel(rcsCommand: RcsCommand): number {
  const { right } = rcsCommand;
  if (right === 0) {
    return 0;
  }
  return right;
}
