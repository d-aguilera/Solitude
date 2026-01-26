import type { GameState } from "../app/appPorts.js";
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
  anchor: ScreenPoint;
  name: string;
  distanceKm: number;
  speedKmh: number;
}

export interface RenderedFace {
  p0: ScreenPoint;
  p1: ScreenPoint;
  p2: ScreenPoint;
  color: RGB;
}

export interface RenderedHud {
  currentThrustPercent: number;
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

export interface RenderParams extends GameState {
  pilotSurface: RenderSurface2D;
  topSurface: RenderSurface2D;
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
