import type {
  SceneLabelCandidate,
  WorldMarker,
  WorldMarkerShape,
  WorldSegment,
} from "../app/pluginPorts";
import type { DomainCameraPose, Scene, SceneObject } from "../app/scenePorts";
import type { ScreenPoint } from "./scrn";

export interface Point {
  x: number;
  y: number;
}

/**
 * Rasterizer for projected scene overlays.
 */
export interface SceneOverlayRasterizer {
  clear(): void;
  drawSceneLabels(labels: RenderedSceneLabel[], count: number): void;
  drawMarkers(markers: RenderedMarker[], count: number): void;
  drawPolylines(polylines: RenderedPolyline[], count: number): void;
  drawSegments(segments: RenderedSegment[], count: number): void;
}

export interface RenderedMarker {
  position: ScreenPoint;
  cssColor: string;
  radius: number;
  lineWidth: number;
  shape: WorldMarkerShape;
}

export interface RenderedSceneLabel {
  anchor: Point;
  edgePoint: Point;
  lineHeight: number;
  lines: string[];
  name: string;
  padding: Size;
  position: Point;
  size: Size;
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
  markers: RenderedMarker[];
  markerCount: number;
  sceneLabels: RenderedSceneLabel[];
  sceneLabelCount: number;
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
  objectsFilter?: (obj: SceneObject) => boolean;
  renderPolylines: boolean;
  renderSegments: boolean;
  renderSceneLabels: boolean;
  sceneLabelCandidates: SceneLabelCandidate[];
  scene: Scene;
  surface: RenderSurface2D;
  worldSegments: WorldSegment[];
  worldMarkers: WorldMarker[];
}
