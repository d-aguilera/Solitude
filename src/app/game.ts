import { resolveCollisions } from "../domain/collisions.js";
import type { GravityEngine } from "../domain/domainPorts.js";
import { buildInitialGravityState } from "../domain/gravityState.js";
import { getDominantBody } from "../domain/orbit.js";
import { type Vec3, vec3 } from "../domain/vec3.js";
import type { SimControlState } from "./appInternals.js";
import type {
  TickCallback,
  TickOutput,
  TickParams,
  WorldAndScene,
} from "./appPorts.js";
import type { ThrustCommand } from "./controls.js";
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
  let thrustCommand: ThrustCommand;
  let alignTargetDirection: Vec3 | null = null;
  const alignTargetScratch = vec3.zero();

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

    alignTargetDirection = null;
    if (controlInput.alignToBody) {
      const primary = getDominantBody(
        worldAndScene.world,
        worldAndScene.mainShip.position,
      );
      if (primary) {
        vec3.subInto(
          alignTargetScratch,
          primary.position,
          worldAndScene.mainShip.position,
        );
        if (vec3.lengthSq(alignTargetScratch) > 0) {
          alignTargetDirection = alignTargetScratch;
        }
      }
    }

    updateShipOrientationFromControls(
      dtMillis,
      worldAndScene.mainShip,
      controlInput,
      simControlState,
      alignTargetDirection,
    );
    applyThrust(dtMillis, worldAndScene.mainShip, thrustCommand);
    updateFrameAlignToVelocity(dtMillis, worldAndScene.enemyShip);

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
