import type { PolylineSceneObject } from "@solitude/engine/render";

export type Trajectory = {
  intervalMillis: number;
  remainingMillis: number;
  sceneObject: PolylineSceneObject;
};
