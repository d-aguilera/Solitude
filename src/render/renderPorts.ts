import type { DomainCameraPose, Scene } from "../app/appPorts.js";
import type { Mesh, RGB, ShipBody, Vec3 } from "../domain/domainPorts.js";

export type DrawMode = "faces" | "lines";

export const drawMode: DrawMode = "faces";

/**
 * Top-level view rendering abstraction.
 */
export interface HudRenderer {
  render(renderParams: HudRenderParams): RenderedHud;
}

export interface HudRenderParams {
  currentThrustLevel: number;
  fps: number;
  pilotCameraLocalOffset: Vec3;
  profilingEnabled: boolean;
  speedMps: number;
}

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
  clear(color: string): void;
  drawBodyLabels(labels: RenderedBodyLabel[]): void;
  drawFaces(faces: RenderedFace[]): void;
  drawHud(hud: RenderedHud): void;
  drawPolylines(polylines: RenderedPolyline[]): void;
  drawSegments(segments: RenderedSegment[]): void;
  measureText(text: string, font: string): TextMetrics;
}

export interface Renderable {
  mesh: Mesh;
  worldPoints: Vec3[];
  lineWidth: number;
  baseColor: RGB;
}

export interface RenderedBodyLabel {
  anchor: ScreenPoint;
  distanceKm: number;
  edgePoint: ScreenPoint;
  lineHeight: number;
  lines: string[];
  name: string;
  padding: {
    width: number;
    height: number;
  };
  position: ScreenPoint;
  size: {
    width: number;
    height: number;
  };
  speedKmh: number;
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

/**
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextMetrics)
 */
export interface TextMetrics {
  readonly actualBoundingBoxAscent: number;
  readonly actualBoundingBoxDescent: number;
  readonly actualBoundingBoxLeft: number;
  readonly actualBoundingBoxRight: number;
  readonly alphabeticBaseline: number;
  readonly emHeightAscent: number;
  readonly emHeightDescent: number;
  readonly fontBoundingBoxAscent: number;
  readonly fontBoundingBoxDescent: number;
  readonly hangingBaseline: number;
  readonly ideographicBaseline: number;
  readonly width: number;
}

/**
 * Top-level view rendering abstraction.
 */
export interface ViewRenderer {
  render(renderParams: ViewRenderParams): RenderedView;
}

export interface ViewRenderParams {
  camera: DomainCameraPose;
  mainShip: ShipBody;
  scene: Scene;
  surface: RenderSurface2D;
}
