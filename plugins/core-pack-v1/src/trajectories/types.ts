import type { ExternalPolylineSceneObject } from "@solitude/plugin-api";

export interface Trajectory {
  intervalMillis: number;
  remainingMillis: number;
  sceneObject: ExternalPolylineSceneObject;
}
