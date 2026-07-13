import type { ExternalPolylineSceneObject } from "@solitude/plugin-api/plugin";

export interface Trajectory {
  intervalMillis: number;
  remainingMillis: number;
  sceneObject: ExternalPolylineSceneObject;
}
