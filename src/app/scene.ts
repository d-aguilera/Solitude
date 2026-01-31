import { vec3 } from "../domain/vec3.js";
import type {
  ControlInput,
  SceneControlState,
  SceneState,
  SimulationState,
} from "./appPorts.js";
import { updatePilotCameraOffset, updateCameras } from "./cameras.js";
import { updatePilotLook } from "./controls.js";
import { updateTrajectories } from "./trajectories.js";
import {
  rotateCelestialBodies,
  syncLightsToStars,
  syncPlanetsToSceneObjects,
  syncShipsToSceneObjects,
  syncStarsToSceneObjects,
} from "./worldSetup.js";

export function mutateScene(
  dtSeconds: number,
  sceneState: SceneState,
  sceneControlState: SceneControlState,
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
  } = sceneState;

  sceneState.speedMps = vec3.length(mainShip.velocity);

  syncShipsToSceneObjects(world.shipBodies, scene);
  syncPlanetsToSceneObjects(world.planets, scene);
  syncStarsToSceneObjects(world.stars, scene);
  syncLightsToStars(world, scene);
  rotateCelestialBodies(scene, dtSeconds);

  sceneState.trajectoryAccumTime = updateTrajectories(
    dtSeconds,
    scene,
    mainShip,
    planetPathMappings,
    planetTrajectories,
    trajectoryAccumTime,
  );

  updatePilotLook(dtSeconds, controlInput, sceneControlState.look);

  updatePilotCameraOffset(
    dtSeconds,
    controlInput,
    sceneControlState.pilotCameraLocalOffset,
  );

  updateCameras(mainShip, pilotCamera, topCamera, sceneControlState);
}
