import type { ExternalPolylineSceneObject } from "@solitude/plugin-api/scene";

export interface Trajectory {
  intervalMillis: number;
  remainingMillis: number;
  sceneObject: ExternalPolylineSceneObject;
}
