import type { GravityEngine, GravityState } from "../domain/domainPorts.js";
import { buildInitialGravityState } from "../domain/gravityState.js";
import { vec3 } from "../domain/vec3.js";
import type {
  GravityBodyBinding,
  SceneState,
  SimControlState,
  SimulationState,
} from "./appInternals.js";
import type {
  GameplayParameters,
  SceneControlState,
  TickCallback,
  TickOutput,
  TickParams,
} from "./appPorts.js";
import {
  updateControlState,
  updateShipOrientationFromControls,
} from "./controls.js";
import { updateFps } from "./fps.js";
import { buildGravityBindings, applyThrust, applyGravity } from "./physics.js";
import { updateSceneGraph } from "./scene.js";
import { getShipById } from "./worldLookup.js";
import { createInitialSceneAndWorld } from "./worldSetup.js";

/**
 * App‑core game entry.
 */
export function createTickHandler(
  gameplayParams: GameplayParameters,
  gravityEngine: GravityEngine,
): TickCallback {
  const x = createInitialSceneAndWorld();

  let gravityBindings: GravityBodyBinding[] = buildGravityBindings(x.world);

  // Determine which gravity body corresponds to the main ship.
  let mainShipBodyIndex: number = gravityBindings.findIndex(
    (b) => b.kind === "ship" && b.id === x.mainShipId,
  );

  if (mainShipBodyIndex === -1) {
    throw new Error(
      `startGame: main ship body not found in gravity bindings for id=${x.mainShipId}`,
    );
  }

  const mainShip = getShipById(x.world, x.mainShipId);

  const gravityState: GravityState = buildInitialGravityState(x.world);

  const mainShipBodyState = gravityState.bodies[mainShipBodyIndex];

  const simControlState: SimControlState = {
    alignToVelocity: false,
    thrustLevel: 0,
  };

  const simState: SimulationState = {
    gravityBindings,
    gravityEngine,
    gravityState,
    mainShip,
    mainShipBodyState,
    world: x.world,
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
    planetTrajectories: x.planetTrajectories,
    scene: x.scene,
    speedMps: 0,
    topCamera: x.topCamera,
  };

  let dtMs: number;
  let dtSeconds: number;
  let dtSecondsSim: number;
  let lastTimeMs: number;
  let initialized = false;
  let currentThrustPercent: number;

  /**
   * Per‑frame update/render entry called by the game loop.
   */
  return (output: TickOutput, params: TickParams): void => {
    const { controlInput, nowMs, paused } = params;

    if (!initialized) {
      lastTimeMs = nowMs - 1;
      initialized = true;
    }

    dtMs = paused ? 0 : nowMs - lastTimeMs;
    dtSeconds = dtMs / 1000;
    dtSecondsSim = (dtMs * gameplayParams.simulationTimeScale) / 1000;
    lastTimeMs = nowMs;

    currentThrustPercent = updateControlState(controlInput, simControlState);

    updateShipOrientationFromControls(
      dtSeconds,
      mainShip,
      controlInput,
      simControlState,
    );

    applyThrust(dtSeconds, mainShip, mainShipBodyState, currentThrustPercent);

    applyGravity(
      dtSecondsSim,
      x.world,
      gravityEngine,
      gravityState,
      gravityBindings,
    );

    updateSceneGraph(
      dtSecondsSim,
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

    output.fps = paused || dtSeconds === 0 ? 0 : updateFps(dtSeconds);
    output.mainShip = mainShip;
    output.pilotCamera = sceneState.pilotCamera;
    output.pilotCameraLocalOffset = sceneControlState.pilotCameraLocalOffset;
    output.scene = sceneState.scene;
    output.speedMps = sceneState.speedMps;
    output.topCamera = sceneState.topCamera;
  };
}
