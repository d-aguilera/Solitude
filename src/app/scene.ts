import type { ShipBody } from "../domain/domainPorts.js";
import { vec3 } from "../domain/vec3.js";
import type { SceneState } from "./appInternals.js";
import type { ControlInput, SceneControlState } from "./appPorts.js";
import { updatePilotCameraOffset, updateCameras } from "./cameras.js";
import { updatePilotLook } from "./controls.js";
import { updateTrajectories } from "./trajectories.js";
import { rotateCelestialBodies } from "./syncSceneObjects.js";

export function updateSceneGraph(
  dtMillis: number,
  dtSimMillis: number,
  sceneState: SceneState,
  sceneControlState: SceneControlState,
  mainShip: ShipBody,
  controlInput: ControlInput,
) {
  const { pilotCamera, topCamera, scene, trajectories } = sceneState;

  rotateCelestialBodies(dtSimMillis, scene.objects);
  updateTrajectories(dtSimMillis, trajectories);

  updatePilotLook(dtMillis, controlInput, sceneControlState.look);
  updatePilotCameraOffset(
    dtMillis,
    controlInput,
    sceneControlState.pilotCameraLocalOffset,
  );

  updateCameras(mainShip, pilotCamera, topCamera, sceneControlState);

  sceneState.speedMps = vec3.length(mainShip.velocity);
}
