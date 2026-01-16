import type { Vec3 } from "../domain/domainPorts.js";
import type { Scene } from "./scene/scenePorts.js";
import type { Profiler } from "../app/profilingPorts.js";
import type { View } from "./projection/View.js";
import type { ViewDebugOverlay } from "./projection/ViewDebugOverlay.js";

/**
 * Adapter-level plane DTO used for debug overlays.
 *
 * This mirrors only the data the renderer needs and is intentionally
 * detached from app/world-layer Plane types.
 */
export interface RenderPlane {
  id: string;
  position: Vec3;
  velocity: Vec3;
}

/**
 * Public view configuration type used by app code to drive renderers.
 *
 * This lives in the render layer so render implementations do not
 * depend on app-layer definitions.
 */
export interface ViewConfig {
  view: View;
  debugOverlay?: ViewDebugOverlay;
  referencePlane: RenderPlane;
  drawMode: View["drawMode"];
}

/**
 * Top-level rendering abstraction for the app layer.
 *
 * This interface defines the boundary from the app into the render layer.
 */
export interface Renderer {
  renderFrame(params: {
    pilotScene: Scene;
    topScene: Scene;
    mainPlane: RenderPlane;
    pilotContext: CanvasRenderingContext2D;
    topContext: CanvasRenderingContext2D;
    profiler: Profiler;
    pilotCameraLocalOffset: Vec3;
    thrustPercent: number;
    profilingEnabled: boolean;
    pilotView: ViewConfig;
    topView: ViewConfig;
  }): void;
}
