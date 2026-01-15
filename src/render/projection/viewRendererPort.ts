import type { Profiler } from "../../world/domain.js";
import type { Scene } from "../../world/types.js";
import type { ViewConfig } from "../../app/viewConfig.js";

/**
 * Thin abstraction over how individual views are rendered.
 */
export interface ViewRenderer {
  renderView(params: {
    context: CanvasRenderingContext2D;
    scene: Scene;
    viewConfig: ViewConfig;
    profiler: Profiler;
  }): void;
}
