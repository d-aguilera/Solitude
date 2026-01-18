import type { DrawMode, HudRenderData } from "../app/appPorts.js";
import type { Scene } from "../appScene/appScenePorts.js";
import type { RGB, Vec3 } from "../domain/domainPorts.js";
import type { Camera, NdcPoint } from "../scene/scenePorts.js";

export interface FaceEntry {
  baseColor: RGB;
  depth: number;
  intensity: number;
  p0: ScreenPoint;
  p1: ScreenPoint;
  p2: ScreenPoint;
}

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

export interface ScreenPoint {
  x: number;
  y: number;
  depth: number; // camera-space depth (positive means in front of camera)
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
 * Thin abstraction over how individual views are rendered.
 */

export interface ViewRenderer {
  renderView(params: ViewRendererParams): void;
}

export type ViewRendererParams = {
  context: CanvasRenderingContext2D;
  scene: Scene;
  viewConfig: ViewConfig;
};
