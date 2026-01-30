import { vec3 } from "../domain/vec3.js";
import type {
  GameState,
  ControlInput,
  SimulationState,
  SimControlState,
  PresentationState,
  ViewControlState,
} from "./appPorts.js";
import { updatePilotCameraOffset, updateCameras } from "./cameras.js";
import {
  updateThrustMagnitudeFromInput,
  getSignedThrustPercent,
  updateAlignToVelocityFromInput,
  updateShipOrientationFromControls,
  updatePilotLook,
} from "./controls.js";
import { integrateForcesAndGravity } from "./physics.js";
import { updateTrajectories } from "./trajectories.js";
import {
  syncShipsToSceneObjects,
  syncPlanetsToSceneObjects,
  syncStarsToSceneObjects,
  syncLightsToStars,
  rotateCelestialBodies,
} from "./worldSetup.js";

/**
 * Advance world/scene state (physics, gravity, trajectories, cameras).
 */
export function handleTick(
  dtSeconds: number,
  gameState: GameState,
  controlInput: ControlInput,
): void {
  const { presentationState, simControlState, simState, viewControlState } =
    gameState;
  advanceSimulation(dtSeconds, simState, simControlState, controlInput);
  updatePresentation(
    dtSeconds,
    presentationState,
    viewControlState,
    simState,
    controlInput,
  );
}

function advanceSimulation(
  dtSeconds: number,
  simState: SimulationState,
  controlState: SimControlState,
  controlInput: ControlInput,
) {
  const {
    gravityBindings,
    gravityEngine,
    gravityState,
    mainShip,
    mainShipBodyState,
    world,
  } = simState;
  updateThrustMagnitudeFromInput(controlInput, controlState);
  simState.currentThrustPercent = getSignedThrustPercent(
    controlInput,
    controlState,
  );
  updateAlignToVelocityFromInput(controlInput, controlState);
  updateShipOrientationFromControls(
    dtSeconds,
    mainShip,
    controlInput,
    controlState,
  );
  integrateForcesAndGravity(
    dtSeconds,
    world,
    mainShip,
    mainShipBodyState,
    gravityEngine,
    gravityState,
    gravityBindings,
    simState.currentThrustPercent,
  );
}

function updatePresentation(
  dtSeconds: number,
  presentationState: PresentationState,
  viewControlState: ViewControlState,
  simState: SimulationState,
  controlInput: ControlInput,
) {
  const { mainShip, world } = simState;
  const {
    pilotCamera,
    topCamera,
    planetPathMappings,
    planetTrajectories,
    scene,
    trajectoryAccumTime,
  } = presentationState;
  presentationState.speedMps = vec3.length(mainShip.velocity);
  syncShipsToSceneObjects(world, scene);
  syncPlanetsToSceneObjects(world, scene);
  syncStarsToSceneObjects(world, scene);
  syncLightsToStars(world, scene);
  rotateCelestialBodies(scene, dtSeconds);
  presentationState.trajectoryAccumTime = updateTrajectories(
    dtSeconds,
    scene,
    mainShip,
    planetPathMappings,
    planetTrajectories,
    trajectoryAccumTime,
  );
  updatePilotLook(dtSeconds, controlInput, viewControlState.look);
  updatePilotCameraOffset(
    dtSeconds,
    controlInput,
    viewControlState.pilotCameraLocalOffset,
  );
  updateCameras(mainShip, pilotCamera, topCamera, viewControlState);
}
