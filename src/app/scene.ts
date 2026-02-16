import { vec3 } from "../domain/vec3.js";
import type { SceneState, SimulationState } from "./appInternals.js";
import type { ControlInput, SceneControlState } from "./appPorts.js";
import { updatePilotCameraOffset, updateCameras } from "./cameras.js";
import { updatePilotLook } from "./controls.js";
import { updateTrajectories } from "./trajectories.js";
import {
  rotateCelestialBodies,
  syncLightsToStars,
  syncPlanetsToSceneObjects,
  syncShipsToSceneObjects,
  syncStarsToSceneObjects,
} from "./syncSceneObjects.js";

export function updateSceneGraph(
  dtSeconds: number,
  sceneState: SceneState,
  sceneControlState: SceneControlState,
  simState: SimulationState,
  controlInput: ControlInput,
) {
  const { mainShip, world } = simState;

  const { pilotCamera, topCamera, planetPathMappings, scene, trajectories } =
    sceneState;

  syncShipsToSceneObjects(world.shipBodies, scene);
  syncPlanetsToSceneObjects(world.planets, scene);
  syncStarsToSceneObjects(world.stars, scene);
  syncLightsToStars(world, scene);

  rotateCelestialBodies(scene, dtSeconds);

  updateTrajectories(
    dtSeconds,
    scene.objects,
    planetPathMappings,
    trajectories,
  );

  updatePilotLook(dtSeconds, controlInput, sceneControlState.look);

  updatePilotCameraOffset(
    dtSeconds,
    controlInput,
    sceneControlState.pilotCameraLocalOffset,
  );

  updateCameras(mainShip, pilotCamera, topCamera, sceneControlState);

  sceneState.speedMps = vec3.length(mainShip.velocity);
}
