import type {
  GravityEngine,
  GravityState,
  PlanetPathMapping,
  Profiler,
  ShipBody,
  Vec3,
  World,
} from "../domain/domainPorts.js";
import { getShipById } from "../domain/worldLookup.js";
import type { ControlState } from "./appInternals.js";
import type {
  ControlInput,
  DomainCameraPose,
  GameState,
  GravityBodyBinding,
  ProfilerController,
  Scene,
  TickCallback,
} from "./appPorts.js";
import { updateCameras, updatePilotCameraOffset } from "./cameras.js";
import {
  createInitialControlState,
  updateAlignToVelocityFromInput,
  updatePilotLook,
  updateShipOrientationFromControls,
  updateThrustMagnitudeFromInput,
} from "./controls.js";
import { updateFPS } from "./fps.js";
import { pauseControl, paused } from "./pause.js";
import {
  buildGravityBindings,
  buildInitialGravityState,
  integrateForcesAndGravity,
} from "./physics.js";
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
    pilotCameraLocalOffset: { x: 0, y: 1.7, z: 1.1 },
  };

  const mainShip: ShipBody = getShipById(gameState.world, gameState.mainShipId);

  let trajectoryAccumTime = 0;

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

    updateFPS(nowMs);

    stepSimulation(
      dtSeconds,
      gameState.world,
      gameState.scene,
      gameState.pilotCamera,
      gameState.topCamera,
      mainShip,
      mainShipBodyIndex,
      gravityEngine,
      gravityState,
      gravityBindings,
      controlInput,
      gameState.controlState,
      gameState.pilotCameraLocalOffset,
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
  dtSeconds: number,
  world: World,
  scene: Scene,
  pilotCamera: DomainCameraPose,
  topCamera: DomainCameraPose,
  mainShip: ShipBody,
  mainShipBodyIndex: number,
  gravityEngine: GravityEngine,
  gravityState: GravityState,
  gravityBindings: GravityBodyBinding[],
  input: ControlInput,
  controlState: ControlState,
  pilotCameraLocalOffset: Vec3,
  planetPathMappings: PlanetPathMapping[],
  planetTrajectories: PlanetTrajectory[],
  trajectoryAccumTime: number,
): void {
  updateThrustMagnitudeFromInput(input, controlState);
  updatePilotLook(dtSeconds, input, controlState.look);
  updateAlignToVelocityFromInput(input, controlState);
  updateShipOrientationFromControls(dtSeconds, mainShip, input, controlState);
  updatePilotCameraOffset(dtSeconds, input, pilotCameraLocalOffset);
  integrateForcesAndGravity(
    dtSeconds,
    world,
    mainShip,
    mainShipBodyIndex,
    gravityEngine,
    gravityState,
    gravityBindings,
    input,
    controlState,
  );
  syncShipsToSceneObjects(world, scene);
  syncPlanetsToSceneObjects(world, scene);
  syncStarsToSceneObjects(world, scene);
  syncLightsToStars(world, scene);
  rotateCelestialBodies(scene, dtSeconds);
  updateTrajectories(
    dtSeconds,
    scene,
    mainShip,
    planetPathMappings,
    planetTrajectories,
    trajectoryAccumTime,
  );
  updateCameras(
    mainShip,
    pilotCamera,
    topCamera,
    pilotCameraLocalOffset,
    controlState,
  );
}
