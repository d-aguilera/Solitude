import type {
  GravityEngine,
  GravityState,
  PlanetPathMapping,
  Profiler,
  ShipBody,
} from "../domain/domainPorts.js";
import { buildInitialGravityState } from "../domain/gravityState.js";
import { vec3 } from "../domain/vec3.js";
import { getShipById } from "../domain/worldLookup.js";
import type {
  ControlInput,
  GameState,
  GravityBodyBinding,
  ProfilerController,
  TickCallback,
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
import type { PlanetTrajectory } from "./trajectories.js";
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

  let gameState: GameState = {
    scene: x.scene,
    world: x.world,
    mainShipId: x.mainShipId,
    topCamera: x.topCamera,
    pilotCamera: x.pilotCamera,
    controlState: createInitialControlState(),
    fps: 0,
    currentThrustPercent: 0,
    pilotCameraLocalOffset: vec3.zero(),
    speedMps: 0,
  };

  const mainShip: ShipBody = getShipById(gameState.world, gameState.mainShipId);

  let trajectoryAccumTime: { time: number } = { time: 0 };

  let planetPathMappings: PlanetPathMapping[] = x.planetPathMappings;
  let planetTrajectories: PlanetTrajectory[] = x.planetTrajectories;

  let gravityState: GravityState = buildInitialGravityState(gameState.world);
  let gravityBindings: GravityBodyBinding[] = buildGravityBindings(
    gameState.world,
  );

  // Determine which gravity body corresponds to the main ship.
  let mainShipBodyIndex: number = gravityBindings.findIndex(
    (b) => b.kind === "ship" && b.id === gameState.mainShipId,
  );

  if (mainShipBodyIndex === -1) {
    throw new Error(
      `startGame: main ship body not found in gravity bindings for id=${gameState.mainShipId}`,
    );
  }

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
  }): Readonly<GameState> => {
    if (!initialized) {
      lastTimeMs = nowMs;
      initialized = true;
      return gameState;
    }

    const dtMs = nowMs - lastTimeMs;
    const dtSeconds = paused ? 0 : dtMs / 1000;
    lastTimeMs = nowMs;

    pauseControl(envInput.pauseToggle);

    profilerController.setEnabled(profilingEnabled);
    profilerController.setPaused(paused);
    profilerController.check();

    gameState.fps = paused ? 0 : 1 / dtSeconds;

    stepSimulation(
      gameState,
      dtSeconds,
      mainShip,
      mainShipBodyIndex,
      gravityEngine,
      gravityState,
      gravityBindings,
      controlInput,
      planetPathMappings,
      planetTrajectories,
      trajectoryAccumTime,
    );

    profilerController.flush();

    return gameState;
  };
}

/**
 * Advance world/scene state (physics, gravity, trajectories, cameras).
 */
function stepSimulation(
  gameState: GameState,
  dtSeconds: number,
  mainShip: ShipBody,
  mainShipBodyIndex: number,
  gravityEngine: GravityEngine,
  gravityState: GravityState,
  gravityBindings: GravityBodyBinding[],
  controlInput: ControlInput,
  planetPathMappings: PlanetPathMapping[],
  planetTrajectories: PlanetTrajectory[],
  trajectoryAccumTime: { time: number },
): void {
  updateThrustMagnitudeFromInput(controlInput, gameState.controlState);
  gameState.currentThrustPercent = getSignedThrustPercent(
    controlInput,
    gameState.controlState,
  );
  updatePilotLook(dtSeconds, controlInput, gameState.controlState.look);
  updateAlignToVelocityFromInput(controlInput, gameState.controlState);
  updateShipOrientationFromControls(
    dtSeconds,
    mainShip,
    controlInput,
    gameState.controlState,
  );
  updatePilotCameraOffset(
    dtSeconds,
    controlInput,
    gameState.controlState.pilotCameraLocalOffset,
  );
  integrateForcesAndGravity(
    dtSeconds,
    gameState.world,
    mainShip,
    mainShipBodyIndex,
    gravityEngine,
    gravityState,
    gravityBindings,
    gameState.currentThrustPercent,
  );
  gameState.speedMps = vec3.length(mainShip.velocity);
  syncShipsToSceneObjects(gameState.world, gameState.scene);
  syncPlanetsToSceneObjects(gameState.world, gameState.scene);
  syncStarsToSceneObjects(gameState.world, gameState.scene);
  syncLightsToStars(gameState.world, gameState.scene);
  rotateCelestialBodies(gameState.scene, dtSeconds);
  updateTrajectories(
    dtSeconds,
    gameState.scene,
    mainShip,
    planetPathMappings,
    planetTrajectories,
    trajectoryAccumTime,
  );
  updateCameras(
    mainShip,
    gameState.pilotCamera,
    gameState.topCamera,
    gameState.controlState,
  );
}
