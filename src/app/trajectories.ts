import type { BodyId } from "../domain/domainPorts.js";
import { vec3 } from "../domain/vec3.js";
import { alloc } from "../global/allocProfiler.js";
import type { Trajectory } from "./appInternals.js";
import type { PolylineSceneObject } from "./appPorts.js";

export function createTrajectory(
  capacity: number,
  intervalMillis: number,
  sceneObject: PolylineSceneObject,
): Trajectory {
  const mesh = sceneObject.mesh;
  mesh.points = Array.from({ length: capacity }).map(() => vec3.zero());
  return {
    intervalMillis,
    remainingMillis: 0,
    sceneObject,
  };
}

/**
 * Sample and update trajectory polylines for the ship and planets.
 */
export function updateTrajectories(
  dtMillis: number,
  trajectories: Record<BodyId, Trajectory>,
): void {
  alloc.withName(updateTrajectories.name, () => {
    for (const key of Object.keys(trajectories)) {
      const trajectory = trajectories[key];
      const obj = trajectory.sceneObject;
      const points = obj.mesh.points;
      if (trajectory.remainingMillis <= 0) {
        if (obj.count < points.length) obj.count++;
        obj.tail = (obj.tail + 1) % points.length;
        vec3.copyInto(points[obj.tail], obj.position);
        trajectory.remainingMillis += trajectory.intervalMillis;
      }
      trajectory.remainingMillis -= dtMillis;
    }
  });
}
