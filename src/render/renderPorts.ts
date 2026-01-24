import type { ControlState } from "../app/appInternals.js";
import type {
  ControlInput,
  DomainCameraPose,
  HudRenderData,
  Scene,
} from "../app/appPorts.js";
import type { Mesh, RGB, Vec3, World } from "../domain/domainPorts.js";

export interface FaceEntry {
  baseColor: RGB;
  depth: number;
  intensity: number;
  p0: ScreenPoint;
  p1: ScreenPoint;
  p2: ScreenPoint;
}

/**
 * Rendering adapter responsible for shaded triangle faces.
 */
export interface FaceRenderer {
  render(surface: RenderSurface2D, faces: RenderedFace[]): void;
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

export interface Renderable {
  mesh: Mesh;
  worldPoints: Vec3[];
  lineWidth: number;
  baseColor: RGB;
}

export interface RenderedFace {
  p0: ScreenPoint;
  p1: ScreenPoint;
  p2: ScreenPoint;
  color: RGB;
}

/**
 * Top-level rendering abstraction for the app layer.
 */
export interface Renderer {
  renderCurrentFrame(renderParams: RenderParams): void;
}

export interface RenderParams {
  controlState: ControlState;
  input: ControlInput;
  scene: Scene;
  world: World;
  mainShipId: string;
  pilotCamera: DomainCameraPose;
  topCamera: DomainCameraPose;
  pilotSurface: RenderSurface2D;
  topSurface: RenderSurface2D;
  pilotCameraLocalOffset: Vec3;
}

/**
 * Adapter-level ship DTO used for debug overlays.
 */
export interface RenderShip {
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
 * Optional debug overlay hook for a view. Not part of scene geometry.
 */
export interface ViewDebugOverlay<TContext = OverlayBody[]> {
  draw: (overlay: ViewDebugOverlayRenderer, context: TContext) => void;
}

/**
 * Rendering adapter for debug overlays on a view.
 */
export interface ViewDebugOverlayRenderer {
  drawShipVelocityLine(
    surface: RenderSurface2D,
    segments: {
      start: ScreenPoint;
      end: ScreenPoint;
      color: "forward" | "backward";
    }[],
  ): void;

  drawBodyLabel(
    surface: RenderSurface2D,
    label: {
      anchor: ScreenPoint;
      name: string;
      distanceKm: number;
      speedKmh: number;
    },
  ): void;
}
