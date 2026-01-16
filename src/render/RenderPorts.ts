import type { Vec3 } from "../domain/domainPorts.js";
import type { Scene } from "./scene/scenePorts.js";
import type { Profiler } from "../app/profilingPorts.js";

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
  view: {
    projection: (p: Vec3) => { x: number; y: number; depth: number } | null;
    cameraPos: Vec3;
    cameraFrame: import("../domain/domainPorts.js").LocalFrame;
    drawMode: "faces" | "lines";
  };
  debugOverlay?: {
    draw: (ctx: CanvasRenderingContext2D, scene: Scene) => void;
  };
  referencePlane: RenderPlane;
  drawMode: "faces" | "lines";
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
