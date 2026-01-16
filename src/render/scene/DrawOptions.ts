import type { PointLight, SceneObject } from "../../renderPorts/ScenePorts.js";
import type { View } from "../projection/View.js";
import type { Profiler } from "../../profiling/profilingPorts.js";

export interface DrawOptions {
  objects: SceneObject[];
  view: View;
  lights: PointLight[];
  profiler: Profiler;
  frameId: number;
}
