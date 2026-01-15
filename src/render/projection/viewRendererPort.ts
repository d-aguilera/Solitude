import type { Profiler } from "../../world/domain.js";
import type { Scene } from "../../world/types.js";
import type { ViewConfig } from "../../app/viewConfig.js";

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
