import type { Profiler } from "../../domain/domainPorts.js";
import type { Scene } from "../../domain/domainPorts.js";
import type { ViewConfig } from "../../app/appPorts.js";

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
