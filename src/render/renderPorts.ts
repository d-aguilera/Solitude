import type { HudRenderData } from "../app/appPorts.js";
import type { Scene } from "../appScene/appScenePorts.js";
import type { RGB, Vec3 } from "../domain/domainPorts.js";
import type { ViewConfig } from "./ViewConfig.js";

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
  renderFrame(
    pilotScene: Scene,
    topScene: Scene,
    pilotContext: CanvasRenderingContext2D,
    topContext: CanvasRenderingContext2D,
    pilotView: ViewConfig,
    topView: ViewConfig,
    hud: HudRenderData,
  ): void;
}

export interface ScreenPoint {
  x: number;
  y: number;
  depth: number; // camera-space depth (positive means in front of camera)
}

/**
 * Optional debug overlay hook for a view. Not part of scene geometry.
 */
export interface ViewDebugOverlay {
  draw: (ctx: CanvasRenderingContext2D, scene: Scene) => void;
}
