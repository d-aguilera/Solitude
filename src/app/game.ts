import { resolveCollisions } from "../domain/collisions.js";
import type { GravityEngine } from "../domain/domainPorts.js";
import { buildInitialGravityState } from "../domain/gravityState.js";
import type { SimControlState } from "./appInternals.js";
import type { ThrustCommand } from "./controls.js";
import {
  updateControlState,
  updateShipOrientationFromInput,
} from "./controls.js";
import { applyCelestialSpin, applyGravity, applyThrust } from "./physics.js";
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

    thrustCommand = updateControlState(controlInput, simControlState);

    updateShipOrientationFromInput(
      dtMillis,
      worldAndScene.mainShip,
      controlInput,
      simControlState,
      worldAndScene.world,
    );
    applyThrust(dtMillis, worldAndScene.mainShip, thrustCommand);
    applyGravity(dtMillisSim, gravityEngine, gravityState);
    resolveCollisions(worldAndScene.world);
    applyCelestialSpin(dtMillisSim, worldAndScene.world);

    const { forward, right } = thrustCommand;
    output.currentThrustLevel =
      forward === 0 && right === 0
        ? 0
        : forward !== 0
          ? forward > 0
            ? simControlState.thrustLevel
            : -simControlState.thrustLevel
          : right > 0
            ? simControlState.thrustLevel
            : -simControlState.thrustLevel;
  };
}
