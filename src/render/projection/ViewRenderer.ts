import type { ViewConfig } from "../../app/appPorts.js";
import type { Profiler } from "../../app/profilingPorts.js";
import { Scene } from "../scene/scenePorts.js";

export type ViewRendererParams = {
  context: CanvasRenderingContext2D;
  scene: Scene;
  viewConfig: ViewConfig;
  profiler: Profiler;
};

/**
 * Thin abstraction over how individual views are rendered.
 */
export interface ViewRenderer {
  renderView(params: ViewRendererParams): void;
}
