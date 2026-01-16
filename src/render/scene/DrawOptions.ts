import { Profiler } from "../../profiling/profilingPorts.js";
import type { PointLight, SceneObject } from "../ScenePorts.js";
import type { View } from "../projection/View.js";

export interface DrawOptions {
  objects: SceneObject[];
  view: View;
  lights: PointLight[];
  profiler: Profiler;
  frameId: number;
}
