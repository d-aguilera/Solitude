import { vec3 } from "@solitude/plugin-api/math";
import type {
  ExternalPolylineSceneObject,
  ExternalScene,
} from "@solitude/plugin-api/plugin";
import type { TrajectoryPlan } from "./trajectoryPlan";
import type { Trajectory } from "./types";

export function bindTrajectoryPlanToScene(
  scene: ExternalScene,
  plan: TrajectoryPlan[],
): Trajectory[] {
  const trajectoryList: Trajectory[] = [];
  const sceneObjects = scene.objects;

  const sceneObjectIndex: Record<string, number> = {};
  for (let i = 0; i < sceneObjects.length; i++) {
    sceneObjectIndex[sceneObjects[i].id] = i;
  }

  for (const entry of plan) {
    const sceneObject = sceneObjects[sceneObjectIndex[entry.pathId]] as
      | ExternalPolylineSceneObject
      | undefined;
    if (!sceneObject) {
      throw new Error(`Trajectory scene object not found: ${entry.pathId}`);
    }
    trajectoryList.push(
      createTrajectory(entry.capacity, entry.intervalMillis, sceneObject),
    );
  }

  return trajectoryList;
}

function createTrajectory(
  capacity: number,
  intervalMillis: number,
  sceneObject: ExternalPolylineSceneObject,
): Trajectory {
  sceneObject.mesh.points = Array.from({ length: capacity }, () => vec3.zero());
  return {
    intervalMillis,
    remainingMillis: 0,
    sceneObject,
  };
}
