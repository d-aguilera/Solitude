import { resolveCollisions } from "../domain/collisions.js";
import type { GravityEngine } from "../domain/domainPorts.js";
import { buildInitialGravityState } from "../domain/gravityState.js";
import { vec3 } from "../domain/vec3.js";
import type { SceneState, SimControlState } from "./appInternals.js";
import type {
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
  worldAndScene: WorldAndScene,
): TickCallback {
  let currentThrustPercent: number;
  let simTimeMillis = 0;

  const simControlState: SimControlState = {
    alignToVelocity: false,
    thrustLevel: 0,
  };

  const sceneControlState: SceneControlState = {
    look: {
      azimuth: 0,
      elevation: 0,
    },
    pilotCameraLocalOffset: vec3.create(0, 1.7, 1.1),
    topCameraLocalOffset: vec3.create(0, 0, 50),
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

    output.pilotCameraLocalOffset = sceneControlState.pilotCameraLocalOffset;
    output.speedMps = sceneState.speedMps;
    output.simTimeMillis = simTimeMillis;
  };
}
