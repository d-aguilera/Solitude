import type { GravityEngine, GravityState } from "../domain/domainPorts.js";
import { buildInitialGravityState } from "../domain/gravityState.js";
import { vec3 } from "../domain/vec3.js";
import type {
  SceneState,
  SimControlState,
  SimulationState,
} from "./appInternals.js";
import type {
  SceneControlState,
  TickCallback,
  TickOutput,
  TickParams,
} from "./appPorts.js";
import {
  updateControlState,
  updateShipOrientationFromControls,
} from "./controls.js";
import { applyThrust, applyGravity } from "./physics.js";
import { updateSceneGraph } from "./scene.js";
import { createInitialSceneAndWorld } from "./setup/worldSetup.js";
import { getShipById } from "./worldLookup.js";

const x = createInitialSceneAndWorld();

const mainShip = getShipById(x.world, x.mainShipId);

const gravityState: GravityState = buildInitialGravityState(x.world);

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

/**
 * App‑core game entry.
 */
export function createTickHandler(gravityEngine: GravityEngine): TickCallback {
  const simState: SimulationState = {
    gravityEngine,
    gravityState,
    mainShip,
    simTimeMillis: 0,
    world: x.world,
  };

  /**
   * Per‑frame update/render entry called by the game loop.
   */
  return (output: TickOutput, params: TickParams): void => {
    const { controlInput, dtMillis, dtMillisSim } = params;

    // Accumulate simulation time.
    simState.simTimeMillis += dtMillisSim;

    currentThrustPercent = updateControlState(controlInput, simControlState);

    updateShipOrientationFromControls(
      dtMillis,
      mainShip,
      controlInput,
      simControlState,
    );

    applyThrust(dtMillis, mainShip, currentThrustPercent);

    applyGravity(dtMillisSim, gravityEngine, gravityState);

    updateSceneGraph(
      dtMillis,
      dtMillisSim,
      sceneState,
      sceneControlState,
      simState,
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
    output.simTimeMillis = simState.simTimeMillis;
    output.topCamera = sceneState.topCamera;
  };
}
