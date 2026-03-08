import { resolveCollisions } from "../domain/collisions.js";
import type { GravityEngine } from "../domain/domainPorts.js";
import { buildInitialGravityState } from "../domain/gravityState.js";
import type { Vec3 } from "../domain/vec3.js";
import type { SceneState, SimControlState } from "./appInternals.js";
import type {
  PilotLookState,
  SceneControlState,
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
import { applyGravity, applyThrust } from "./physics.js";
import { updateSceneGraph } from "./scene.js";

/**
 * App‑core game entry.
 */
export function createTickHandler(
  gravityEngine: GravityEngine,
  pilotCameraOffset: Vec3,
  pilotLookState: PilotLookState,
  thrustLevel: number,
  topCameraOffset: Vec3,
  worldAndScene: WorldAndScene,
): TickCallback {
  let currentThrustPercent: number;
  let simTimeMillis = 0;

  const simControlState: SimControlState = {
    alignToVelocity: false,
    thrustLevel,
  };

  const sceneControlState: SceneControlState = {
    pilotLookState,
    pilotCameraOffset,
    topCameraOffset,
  };

  const sceneState: SceneState = {
    pilotCamera: worldAndScene.pilotCamera,
    planetPathMappings: worldAndScene.planetPathMappings,
    scene: worldAndScene.scene,
    speedMps: 0,
    topCamera: worldAndScene.topCamera,
    trajectories: worldAndScene.trajectories,
  };

  const gravityState = buildInitialGravityState(worldAndScene.world);

  /**
   * Per‑frame update/render entry called by the game loop.
   */
  return (output: TickOutput, params: TickParams): void => {
    const { controlInput, dtMillis, dtMillisSim } = params;

    // Accumulate simulation time.
    simTimeMillis += dtMillisSim;

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

    updateSceneGraph(
      dtMillis,
      dtMillisSim,
      sceneState,
      sceneControlState,
      worldAndScene.mainShip,
      controlInput,
    );

    output.currentThrustLevel =
      currentThrustPercent === 0
        ? 0
        : currentThrustPercent > 0
          ? simControlState.thrustLevel
          : -simControlState.thrustLevel;

    output.pilotCameraLocalOffset = sceneControlState.pilotCameraOffset;
    output.speedMps = sceneState.speedMps;
    output.simTimeMillis = simTimeMillis;
  };
}
