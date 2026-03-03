import type { BodyId, ShipBody } from "../domain/domainPorts.js";
import { mat3 } from "../domain/mat3.js";
import { vec3 } from "../domain/vec3.js";
import type { SceneState } from "./appInternals.js";
import type {
  ControlInput,
  SceneControlState,
  SceneObject,
  Trajectory,
} from "./appPorts.js";
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

const Rspin = mat3.zero();

/**
 * Advance axial rotation for planets and stars.
 */
function rotateCelestialBodies(
  dtMillis: number,
  sceneObjects: SceneObject[],
): void {
  if (dtMillis === 0) return;
  for (const obj of sceneObjects) {
    if (obj.kind !== "planet" && obj.kind !== "star") continue;
    const angle = (obj.angularSpeedRadPerSec * dtMillis) / 1000;
    if (angle === 0) continue;
    mat3.rotAxisInto(Rspin, obj.rotationAxis, angle);
    // Orientation is a local→world transform. Apply spin in local space
    // by left-multiplying the existing orientation.
    mat3.mulMat3Into(obj.orientation, Rspin, obj.orientation);
  }
}

/**
 * Sample and update trajectory polylines for the ship and planets.
 */
function updateTrajectories(
  dtMillis: number,
  trajectories: Record<BodyId, Trajectory>,
): void {
  for (const key of Object.keys(trajectories)) {
    const trajectory = trajectories[key];
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
