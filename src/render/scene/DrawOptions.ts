import type {
  PointLight,
  Profiler,
  SceneObject,
} from "../../domain/domainPorts.js";
import type { View } from "../projection/View.js";

export interface DrawOptions {
  objects: SceneObject[];
  view: View;
  lights: PointLight[];
  profiler: Profiler;
  frameId: number;
}
