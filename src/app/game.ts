import { resolveCollisions } from "../domain/collisions.js";
import type { GravityEngine } from "../domain/domainPorts.js";
import { buildInitialGravityState } from "../domain/gravityState.js";
import type { SimControlState } from "./appInternals.js";
import type {
  TickCallback,
  TickOutput,
  TickParams,
  WorldAndScene,
} from "./appPorts.js";
import {
  updateControlState,
  updateFrameAlignToVelocity,
  updateShipOrientationFromControls,
} from "./controls.js";
import { applyCelestialSpin, applyGravity, applyThrust } from "./physics.js";

/**
 * App‑core game entry.
 */
export function createTickHandler(
  gravityEngine: GravityEngine,
  thrustLevel: number,
  worldAndScene: WorldAndScene,
): TickCallback {
  let currentThrustPercent: number;

  const simControlState: SimControlState = {
    alignToVelocity: false,
    thrustLevel,
  };

  const gravityState = buildInitialGravityState(worldAndScene.world);

  /**
   * Per‑frame update/render entry called by the game loop.
   */
  return (output: TickOutput, params: TickParams): void => {
    const { controlInput, dtMillis, dtMillisSim } = params;

    currentThrustPercent = updateControlState(controlInput, simControlState);

    updateShipOrientationFromControls(
      dtMillis,
      worldAndScene.mainShip,
      controlInput,
      simControlState,
    );
    applyThrust(dtMillis, worldAndScene.mainShip, currentThrustPercent);
    updateFrameAlignToVelocity(dtMillis, worldAndScene.enemyShip);

    applyGravity(dtMillisSim, gravityEngine, gravityState);
    resolveCollisions(worldAndScene.world);
    applyCelestialSpin(dtMillisSim, worldAndScene.world);

    output.currentThrustLevel =
      currentThrustPercent === 0
        ? 0
        : currentThrustPercent > 0
          ? simControlState.thrustLevel
          : -simControlState.thrustLevel;
  };
}
