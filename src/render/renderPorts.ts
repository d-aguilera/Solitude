import type { LocalFrame, Vec3 } from "../domain/domainPorts.js";
import type { Scene } from "./scenePorts.js";
import type { Profiler } from "../profiling/profilingPorts.js";
import type { NdcPoint } from "./renderInternals.js";

export type DrawMode = "faces" | "lines";

/**
 * Adapter-level plane DTO used for debug overlays.
 */
export interface RenderPlane {
  id: string;
  position: Vec3;
  velocity: Vec3;
}

/**
 * Top-level rendering abstraction for the app layer.
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

/**
 * Core configuration for rendering a scene from a particular viewpoint.
 */
export interface View {
  projection: (p: Vec3) => NdcPoint | null;
  cameraPos: Vec3;
  cameraFrame: LocalFrame;
  drawMode: DrawMode;
}

/**
 * Public view configuration type used by app code to drive renderers.
 */
export interface ViewConfig {
  view: View;
  debugOverlay?: ViewDebugOverlay;
  referencePlane: RenderPlane;
  drawMode: View["drawMode"];
}

/**
 * Optional debug overlay hook for a view. Not part of scene geometry.
 */
export interface ViewDebugOverlay {
  draw: (ctx: CanvasRenderingContext2D, scene: Scene) => void;
}
