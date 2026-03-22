import type { ShipBody } from "../domain/domainPorts.js";
import { vec3 } from "../domain/vec3.js";
import type { SceneState } from "./appInternals.js";
import type { ControlInput, SceneControlState, Trajectory } from "./appPorts.js";
import { updateCameras, updatePilotCameraOffset } from "./cameras.js";
import { updatePilotLook } from "./controls.js";

export function updateSceneGraph(
  dtMillis: number,
  dtSimMillis: number,
  sceneState: SceneState,
  sceneControlState: SceneControlState,
  mainShip: ShipBody,
  controlInput: ControlInput,
) {
  const { pilotCamera, topCamera, trajectoryList } = sceneState;
  updateTrajectories(dtSimMillis, trajectoryList);

  updatePilotLook(dtMillis, controlInput, sceneControlState.pilotLookState);
  updatePilotCameraOffset(
    dtMillis,
    controlInput,
    sceneControlState.pilotCameraOffset,
  );

  updateCameras(mainShip, pilotCamera, topCamera, sceneControlState);
}

/**
 * Sample and update trajectory polylines for the ship and planets.
 */
function updateTrajectories(
  dtMillis: number,
  trajectoryList: Trajectory[],
): void {
  for (let i = 0; i < trajectoryList.length; i++) {
    const trajectory = trajectoryList[i];
    if (trajectory.remainingMillis <= 0) {
      const obj = trajectory.sceneObject;
      const points = obj.mesh.points;
      if (obj.count < points.length) obj.count++;
      obj.tail = (obj.tail + 1) % points.length;
      vec3.copyInto(points[obj.tail], obj.position);
      trajectory.remainingMillis += trajectory.intervalMillis;
    }
    trajectory.remainingMillis -= dtMillis;
  }
}
