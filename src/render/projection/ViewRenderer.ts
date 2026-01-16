import type { View } from "./View.js";
import type { Scene } from "../../renderPorts/ScenePorts.js";
import type { ViewDebugOverlay } from "./ViewDebugOverlay.js";
import type { DrawMode } from "./ViewDebugOverlay.js";
import { Profiler } from "../../profiling/profilingPorts.js";

export interface ViewConfig {
  view: View;
  debugOverlay?: ViewDebugOverlay;
  referencePlane: {
    id: string;
    position: import("../../domain/domainPorts.js").Vec3;
    velocity: import("../../domain/domainPorts.js").Vec3;
  };
  drawMode: DrawMode;
}

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
