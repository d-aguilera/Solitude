import { vec3 } from "@solitude/engine/domain/vec3";
import type { Trajectory } from "./types";

/**
 * Sample and update trajectory polylines for the ship and planets.
 */
export function updateTrajectories(
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
