import type { GravityEngine } from "../domain/domainPorts.js";
import { buildInitialGravityState } from "../domain/gravityState.js";
import { vec3 } from "../domain/vec3.js";
import type { SceneState, SimControlState } from "./appInternals.js";
import type {
  SceneControlState,
  TickCallback,
  TickOutput,
  TickParams,
  WorldAndSceneConfig,
} from "./appPorts.js";
import {
  updateControlState,
  updateFrameAlignToVelocity,
  updateShipOrientationFromControls,
} from "./controls.js";
import { applyThrust, applyGravity } from "./physics.js";
import { updateSceneGraph } from "./scene.js";
import { createWorldAndScene } from "./setup/worldSetup.js";
import { getShipById } from "./worldLookup.js";

/**
 * App‑core game entry.
 */
export function createTickHandler(
  config: WorldAndSceneConfig,
  gravityEngine: GravityEngine,
): TickCallback {
  const x = createWorldAndScene(config);

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
  const mainShip = getShipById(x.world, config.mainShipId);
  const enemyShip = getShipById(x.world, config.enemyyShipId);
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
      mainShip,
      controlInput,
      simControlState,
    );

    applyThrust(dtMillis, mainShip, currentThrustPercent);

    updateFrameAlignToVelocity(dtMillis, enemyShip);

    applyGravity(dtMillisSim, gravityEngine, gravityState);

    updateSceneGraph(
      dtMillis,
      dtMillisSim,
      sceneState,
      sceneControlState,
      mainShip,
      controlInput,
    );

    output.currentThrustLevel =
      currentThrustPercent === 0
        ? 0
        : currentThrustPercent > 0
          ? simControlState.thrustLevel
          : -simControlState.thrustLevel;

    output.mainShip = mainShip;
    output.pilotCamera = sceneState.pilotCamera;
    output.pilotCameraLocalOffset = sceneControlState.pilotCameraLocalOffset;
    output.scene = sceneState.scene;
    output.speedMps = sceneState.speedMps;
    output.simTimeMillis = simTimeMillis;
    output.topCamera = sceneState.topCamera;
  };
}
