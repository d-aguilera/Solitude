import type { PolylineSceneObject } from "@solitude/engine/app/scenePorts";

export type Trajectory = {
  intervalMillis: number;
  remainingMillis: number;
  sceneObject: PolylineSceneObject;
};
