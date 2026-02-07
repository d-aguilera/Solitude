import type { TickOutput } from "../app/appPorts.js";
import type { Mesh, RGB, Vec3 } from "../domain/domainPorts.js";

/**
 * Normalized device coordinate in the projection plane:
 *   - x, y in [-1, 1] after perspective divide
 *   - depth is camera-space Y (forward distance)
 */
export interface NdcPoint {
  x: number;
  y: number;
  depth: number;
}

/**
 * Rasterizer abstraction.
 */
export interface Rasterizer {
  clear(surface: RenderSurface2D, color: string): void;
  drawBodyLabels(surface: RenderSurface2D, labels: RenderedBodyLabel[]): void;
  drawFaces(surface: RenderSurface2D, faces: RenderedFace[]): void;
  drawHud(surface: RenderSurface2D, hud: RenderedHud): void;
  drawPolylines(surface: RenderSurface2D, polylines: RenderedPolyline[]): void;
  drawSegments(surface: RenderSurface2D, segments: RenderedSegment[]): void;
}

export interface Renderable {
  mesh: Mesh;
  worldPoints: Vec3[];
  lineWidth: number;
  baseColor: RGB;
}

export interface RenderedBodyLabel {
  /**
   * Screen-space anchor for the body (projected center).
   */
  anchor: ScreenPoint;

  name: string;
  distanceKm: number;
  speedKmh: number;

  /**
   * Direction index in [0, 7] selecting one of 8 angles around the
   * body center:
   *
   *   0 ->   0° (top)
   *   1 ->  45°
   *   2 ->  90°
   *   3 -> 135°
   *   4 -> 180°
   *   5 -> 225°
   *   6 -> 270°
   *   7 -> 315°
   *
   * Angles are chosen based on the vector from the body center toward
   * the screen center, clamped to the nearest 45° step.
   */
  directionIndex: number;
}

export interface RenderedFace {
  p0: ScreenPoint;
  p1: ScreenPoint;
  p2: ScreenPoint;
  color: RGB;
}

export interface RenderedHud {
  currentThrustLevel: number;
  fps: number;
  pilotCameraLocalOffset: Vec3;
  profilingEnabled: boolean;
  speedMps: number;
}

export interface RenderedPolyline {
  points: ScreenPoint[];
  cssColor: string;
  lineWidth: number;
}

export interface RenderedSegment {
  start: ScreenPoint;
  end: ScreenPoint;
  cssColor: string;
}

export interface RenderedView {
  bodyLabels: RenderedBodyLabel[];
  faces: RenderedFace[];
  polylines: RenderedPolyline[];
  segments: RenderedSegment[];
}

/**
 * Top-level rendering abstraction for the app layer.
 */
export interface Renderer {
  renderCurrentFrame(renderParams: RenderParams): void;
}

export interface RenderParams extends TickOutput {
  pilotSurface: RenderSurface2D;
  topSurface: RenderSurface2D;
  profilingEnabled: boolean;
}

/**
 * Minimal 2D drawing surface abstraction used by renderers.
 *
 * Implementations may be backed by Canvas2D, WebGL, etc.
 */
export interface RenderSurface2D {
  readonly width: number;
  readonly height: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
  depth: number; // camera-space depth (positive means in front of camera)
}
