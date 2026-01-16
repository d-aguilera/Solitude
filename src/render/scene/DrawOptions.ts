import type { PointLight, SceneObject } from "./scenePorts.js";
import type { View } from "../projection/View.js";
import type { Profiler } from "../../app/profilingPorts.js";

export interface DrawOptions {
  objects: SceneObject[];
  view: View;
  lights: PointLight[];
  profiler: Profiler;
  frameId: number;
}
