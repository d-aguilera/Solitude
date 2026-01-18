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
 * Rendering adapter responsible for HUD drawing on a given surface.
 */
export interface HudRenderer {
  render(surface: RenderSurface2D, hud: HudRenderData): void;
}

export interface OverlayBody {
  id: string;
  position: Vec3;
  velocity: Vec3;
  kind: "planet" | "star";
}

/**
 * Rendering adapter responsible for polylines in screen space.
 */
export interface PolylineRenderer {
  render(
    surface: RenderSurface2D,
    points: ScreenPoint[],
    color: RGB,
    lineWidth: number,
  ): void;
}

/**
 * Top-level rendering abstraction for the app layer.
 */
export interface Renderer {
  renderFrame(
    pilotScene: Scene,
    topScene: Scene,
    pilotSurface: RenderSurface2D,
    topSurface: RenderSurface2D,
    pilotView: ViewConfig,
    topView: ViewConfig,
    hud: HudRenderData,
  ): void;
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
 * Minimal 2D drawing surface abstraction used by renderers.
 *
 * Implementations may be backed by Canvas2D, WebGL, etc.
 */
export interface RenderSurface2D {
  readonly width: number;
  readonly height: number;
  clear(color: string): void;
}

export interface ScreenPoint {
  x: number;
  y: number;
  depth: number; // camera-space depth (positive means in front of camera)
}

/**
 * Rendering adapter responsible for shaded triangle faces.
 */
export interface ShadedFaceRenderer {
  render(surface: RenderSurface2D, faceList: FaceEntry[]): void;
}

/**
 * Optional debug overlay hook for a view. Not part of scene geometry.
 */
export interface ViewDebugOverlay<TContext = OverlayBody[]> {
  draw: (overlay: ViewDebugOverlayRenderer, context: TContext) => void;
}

/**
 * Rendering adapter for debug overlays on a view.
 */
export interface ViewDebugOverlayRenderer {
  drawPlaneVelocityLine(
    segments: {
      start: ScreenPoint;
      end: ScreenPoint;
      color: "forward" | "backward";
    }[],
  ): void;

  drawBodyLabel(label: {
    anchor: ScreenPoint;
    name: string;
    distanceKm: number;
    speedKmh: number;
  }): void;
}
