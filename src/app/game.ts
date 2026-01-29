import type {
  GravityEngine,
  GravityState,
  Profiler,
} from "../domain/domainPorts.js";
import { buildInitialGravityState } from "../domain/gravityState.js";
import { vec3 } from "../domain/vec3.js";
import { getShipById } from "../domain/worldLookup.js";
import type {
  GameState,
  GravityBodyBinding,
  ProfilerController,
  GameOutput,
  TickCallback,
  ControlInput,
} from "./appPorts.js";
import { updateCameras, updatePilotCameraOffset } from "./cameras.js";
import {
  createInitialControlState,
  getSignedThrustPercent,
  updateAlignToVelocityFromInput,
  updatePilotLook,
  updateShipOrientationFromControls,
  updateThrustMagnitudeFromInput,
} from "./controls.js";
import { pauseControl, paused } from "./pause.js";
import { buildGravityBindings, integrateForcesAndGravity } from "./physics.js";
import { updateTrajectories } from "./trajectories.js";
import {
  createInitialSceneAndWorld,
  rotateCelestialBodies,
  syncShipsToSceneObjects,
  syncPlanetsToSceneObjects,
  syncStarsToSceneObjects,
  syncLightsToStars,
} from "./worldSetup.js";

/**
 * App‑core game entry.
 */
export function startGame(
  gravityEngine: GravityEngine,
  profiler: Profiler,
  profilerController: ProfilerController,
): TickCallback {
  void profiler;

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

  const gravityState: GravityState = buildInitialGravityState(x.world);

  const mainShipBodyState = gravityState.bodies[mainShipBodyIndex];

  let gameState: GameState = {
    controlState: createInitialControlState(),
    currentThrustPercent: 0,
    fps: 0,
    gravityBindings,
    gravityEngine,
    gravityState,
    mainShip: getShipById(x.world, x.mainShipId),
    mainShipBodyState,
    pilotCamera: x.pilotCamera,
    pilotCameraLocalOffset: vec3.zero(),
    planetPathMappings: x.planetPathMappings,
    planetTrajectories: x.planetTrajectories,
    scene: x.scene,
    speedMps: 0,
    topCamera: x.topCamera,
    trajectoryAccumTime: 0,
    world: x.world,
  };

  let lastTimeMs: number;
  let initialized = false;

  /**
   * Per‑frame update/render entry called by the outer loop.
   */
  return ({
    nowMs,
    controlInput,
    envInput,
    profilingEnabled,
  }): Readonly<GameOutput> => {
    if (!initialized) {
      lastTimeMs = nowMs - 1;
      initialized = true;
    }

    const dtMs = nowMs - lastTimeMs;
    const dtSeconds = paused ? 0 : dtMs / 1000;
    lastTimeMs = nowMs;

    pauseControl(envInput.pauseToggle);

    profilerController.setEnabled(profilingEnabled);
    profilerController.setPaused(paused);
    profilerController.check();

    gameState.fps = paused ? 0 : 1 / dtSeconds;

    stepSimulation(dtSeconds, gameState, controlInput);

    profilerController.flush();

    return {
      scene: gameState.scene,
      mainShip: gameState.mainShip,
      pilotCamera: gameState.pilotCamera,
      topCamera: gameState.topCamera,
      fps: gameState.fps,
      currentThrustPercent: gameState.currentThrustPercent,
      pilotCameraLocalOffset: gameState.pilotCameraLocalOffset,
      speedMps: gameState.speedMps,
    };
  };
}

/**
 * Advance world/scene state (physics, gravity, trajectories, cameras).
 */
function stepSimulation(
  dtSeconds: number,
  s: GameState,
  controlInput: ControlInput,
): void {
  updateThrustMagnitudeFromInput(controlInput, s.controlState);
  s.currentThrustPercent = getSignedThrustPercent(controlInput, s.controlState);
  updatePilotLook(dtSeconds, controlInput, s.controlState.look);
  updateAlignToVelocityFromInput(controlInput, s.controlState);
  updateShipOrientationFromControls(
    dtSeconds,
    s.mainShip,
    controlInput,
    s.controlState,
  );
  updatePilotCameraOffset(
    dtSeconds,
    controlInput,
    s.controlState.pilotCameraLocalOffset,
  );
  integrateForcesAndGravity(
    dtSeconds,
    s.world,
    s.mainShip,
    s.mainShipBodyState,
    s.gravityEngine,
    s.gravityState,
    s.gravityBindings,
    s.currentThrustPercent,
  );
  s.speedMps = vec3.length(s.mainShip.velocity);
  syncShipsToSceneObjects(s.world, s.scene);
  syncPlanetsToSceneObjects(s.world, s.scene);
  syncStarsToSceneObjects(s.world, s.scene);
  syncLightsToStars(s.world, s.scene);
  rotateCelestialBodies(s.scene, dtSeconds);
  s.trajectoryAccumTime = updateTrajectories(
    dtSeconds,
    s.scene,
    s.mainShip,
    s.planetPathMappings,
    s.planetTrajectories,
    s.trajectoryAccumTime,
  );
  updateCameras(s.mainShip, s.pilotCamera, s.topCamera, s.controlState);
}
