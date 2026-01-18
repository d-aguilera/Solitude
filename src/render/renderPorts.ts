import type { Vec3 } from "../domain/domainPorts.js";
import type { Scene } from "./scenePorts.js";
import type { NdcPoint } from "./renderInternals.js";
import type { Camera } from "../scene/camera.js";

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
    pilotView: ViewConfig;
    topView: ViewConfig;
    hud: HudRenderData;
  }): void;
}

/**
 * Core configuration for rendering a scene from a particular viewpoint.
 */
export interface View {
  camera: Camera;
  projection: (p: Vec3) => NdcPoint | null;
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

/**
 * Adapter‑agnostic HUD inputs.
 */
export interface HudRenderData {
  /**
   * Speed in meters per second for the controlled plane.
   */
  speedMps: number;
  /**
   * Latest measured frames per second.
   */
  fps: number;
  /**
   * Whether profiling is currently enabled.
   */
  profilingEnabled: boolean;
  /**
   * Pilot camera offset expressed in the plane's local frame.
   */
  pilotCameraLocalOffset: Vec3;
  /**
   * Signed thrust level in [-1, 1].
   */
  thrustPercent: number;
}
