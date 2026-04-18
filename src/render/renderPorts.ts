import type { HudGrid } from "../app/hudPorts";
import type { WorldSegment } from "../app/pluginPorts";
import type {
  DomainCameraPose,
  Mesh,
  RGB,
  Scene,
  SceneObject,
} from "../app/scenePorts";
import type { ShipBody } from "../domain/domainPorts";
import type { Vec3 } from "../domain/vec3";
import type { RenderFrameCache } from "./renderFrameCache";
import type { ScreenPoint } from "./scrn";

export type DrawMode = "faces" | "lines";

export const drawMode: DrawMode = "faces";

/**
 * Top-level view rendering abstraction.
 */
export interface HudRenderer {
  renderInto(into: HudGrid, grid: HudGrid): void;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Rasterizer abstraction.
 */
export interface Rasterizer {
  clear(color: string): void;
  drawBodyLabels(labels: RenderedBodyLabel[], count: number): void;
  drawFaces(faces: RenderedFace[], count: number): void;
  drawHud(hud: HudGrid): void;
  drawPolylines(polylines: RenderedPolyline[], count: number): void;
  drawSegments(segments: RenderedSegment[], count: number): void;
  measureText(text: string, font: string): TextMetrics;
}

export interface Renderable {
  mesh: Mesh;
  worldPoints: Vec3[];
  lineWidth: number;
  baseColor: RGB;
}

export interface RenderedBodyLabel {
  anchor: Point;
  edgePoint: Point;
  lineHeight: number;
  lines: string[];
  name: string;
  padding: Size;
  position: Point;
  size: Size;
}

export interface RenderedFace {
  p0: ScreenPoint;
  p1: ScreenPoint;
  p2: ScreenPoint;
  color: RGB;
}

export interface RenderedPolyline {
  points: ScreenPoint[];
  pointCount: number;
  cssColor: string;
  lineWidth: number;
}

export interface RenderedSegment {
  start: ScreenPoint;
  end: ScreenPoint;
  cssColor: string;
  lineWidth: number;
}

export interface RenderedView {
  bodyLabels: RenderedBodyLabel[];
  bodyLabelCount: number;
  faces: RenderedFace[];
  faceCount: number;
  polylines: RenderedPolyline[];
  polylineCount: number;
  segments: RenderedSegment[];
  segmentCount: number;
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

export interface Size {
  width: number;
  height: number;
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
  renderInto(into: RenderedView, renderParams: ViewRenderParams): void;
}

export interface ViewRenderParams {
  camera: DomainCameraPose;
  mainShip: ShipBody;
  objectsFilter?: (obj: SceneObject) => boolean;
  renderFaces?: boolean;
  sortFaces?: boolean;
  renderPolylines?: boolean;
  renderSegments?: boolean;
  renderBodyLabels?: boolean;
  renderCache: RenderFrameCache;
  scene: Scene;
  surface: RenderSurface2D;
  worldSegments: WorldSegment[];
}
