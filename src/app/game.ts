import { resolveCollisions } from "../domain/collisions.js";
import type { GravityEngine } from "../domain/domainPorts.js";
import { buildInitialGravityState } from "../domain/gravityState.js";
import { vec3 } from "../domain/vec3.js";
import type { SceneState, SimControlState } from "./appInternals.js";
import type { WorldAndScene } from "./appPorts.js";
import type {
  SceneControlState,
  TickCallback,
  TickOutput,
  TickParams,
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
  x: WorldAndScene,
): TickCallback {
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
    pilotCamera: x.pilotCamera,
    planetPathMappings: x.planetPathMappings,
    scene: x.scene,
    speedMps: 0,
    topCamera: x.topCamera,
    trajectories: x.trajectories,
  };

  let currentThrustPercent: number;
  const gravityState = buildInitialGravityState(x.world);
  let simTimeMillis = 0;

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
      x.mainShip,
      controlInput,
      simControlState,
    );
    applyThrust(dtMillis, x.mainShip, currentThrustPercent);
    updateFrameAlignToVelocity(dtMillis, x.enemyShip);

    applyGravity(dtMillisSim, gravityEngine, gravityState);
    resolveCollisions(x.world);

    updateSceneGraph(
      dtMillis,
      dtMillisSim,
      sceneState,
      sceneControlState,
      x.mainShip,
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
