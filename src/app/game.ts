import { resolveCollisions } from "../domain/collisions.js";
import type { GravityEngine, World } from "../domain/domainPorts.js";
import { buildInitialGravityState } from "../domain/gravityState.js";
import type { ControlledBodyState, SimControlState } from "./appInternals.js";
import { computeCircleNowThrust } from "./autoPilot.js";
import type { ControlInput } from "./controlPorts.js";
import type { ThrustCommand } from "./controls.js";
import {
  getThrustPercentForLevel,
  maxThrustAcceleration,
  updateControlState,
  updateShipAngularVelocityFromInput,
} from "./controls.js";
import {
  applyCelestialSpin,
  applyGravity,
  applyShipRotation,
  applyThrust,
} from "./physics.js";
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
): TickCallback {
  let thrustCommand: ThrustCommand;

  const simControlState: SimControlState = {
    alignToVelocity: false,
    alignToBody: false,
    thrustLevel,
  };

  const gravityState = buildInitialGravityState(worldAndScene.world);

  /**
   * Per‑frame update/render entry called by the game loop.
   */
  return (output: TickOutput, params: TickParams): void => {
    const { controlInput, dtMillis, dtMillisSim } = params;

    thrustCommand = getThrustCommandForTick(
      dtMillis,
      controlInput,
      simControlState,
      worldAndScene.mainShip,
      worldAndScene.world,
    );

    updateShipAngularVelocityFromInput(
      dtMillis,
      worldAndScene.mainShip,
      controlInput,
      simControlState,
      worldAndScene.world,
    );
    applyShipRotation(dtMillis, worldAndScene.mainShip);
    applyThrust(dtMillis, worldAndScene.mainShip, thrustCommand);
    applyGravity(dtMillisSim, gravityEngine, gravityState);
    resolveCollisions(worldAndScene.world);
    applyCelestialSpin(dtMillisSim, worldAndScene.world);

    output.currentThrustLevel = getRenderedThrustLevel(
      thrustCommand,
      simControlState,
    );
  };
}

function getThrustCommandForTick(
  dtMillis: number,
  controlInput: ControlInput,
  controlState: SimControlState,
  ship: ControlledBodyState,
  world: World,
): ThrustCommand {
  const manualThrust = updateControlState(controlInput, controlState);
  if (!controlInput.circleNow) {
    return manualThrust;
  }

  const thrustPercent = getThrustPercentForLevel(controlState.thrustLevel);
  return computeCircleNowThrust(
    dtMillis,
    ship,
    world,
    thrustPercent,
    maxThrustAcceleration,
  );
}

function getRenderedThrustLevel(
  thrustCommand: ThrustCommand,
  controlState: SimControlState,
): number {
  const { forward, right } = thrustCommand;
  if (forward === 0 && right === 0) {
    return 0;
  }
  if (forward !== 0) {
    return forward > 0 ? controlState.thrustLevel : -controlState.thrustLevel;
  }
  return right > 0 ? controlState.thrustLevel : -controlState.thrustLevel;
}
