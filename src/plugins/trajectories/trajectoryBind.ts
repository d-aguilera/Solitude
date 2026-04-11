import type { Trajectory } from "../../app/runtimePorts";
import type { PolylineSceneObject, Scene } from "../../app/scenePorts";
import { vec3 } from "../../domain/vec3";
import type { TrajectoryPlan } from "./trajectoryPlan";

export function bindTrajectoryPlanToScene(
  scene: Scene,
  plan: TrajectoryPlan[],
): Trajectory[] {
  const trajectoryList: Trajectory[] = [];
  const sceneObjects = scene.objects;

  // Build a scene objects lookup index
  const sceneObjectIndex: Record<string, number> = {};
  for (let i = 0; i < sceneObjects.length; i++) {
    sceneObjectIndex[sceneObjects[i].id] = i;
  }

  for (const entry of plan) {
    const sceneObject = sceneObjects[sceneObjectIndex[entry.pathId]] as
      | PolylineSceneObject
      | undefined;
    if (!sceneObject) {
      throw new Error(`Trajectory scene object not found: ${entry.pathId}`);
    }
    const trajectory = createTrajectory(
      entry.capacity,
      entry.intervalMillis,
      sceneObject,
    );
    trajectoryList.push(trajectory);
  }

  return trajectoryList;
}

function createTrajectory(
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
