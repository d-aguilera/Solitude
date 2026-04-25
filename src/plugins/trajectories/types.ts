import type { PolylineSceneObject } from "../../app/scenePorts";

export type Trajectory = {
  intervalMillis: number;
  remainingMillis: number;
  sceneObject: PolylineSceneObject;
};
