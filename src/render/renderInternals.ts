import type { Mesh, RGB, Vec3 } from "../domain/domainPorts";
import type { Profiler } from "../profiling/profilingPorts";
import type { View, ViewDebugOverlay, DrawMode } from "./renderPorts";
import type { PointLight, Scene, SceneObject } from "./scenePorts";

export interface DrawOptions {
  objects: SceneObject[];
  view: View;
  lights: PointLight[];
  profiler: Profiler;
  frameId: number;
}

export interface FaceEntry {
  intensity: number;
  depth: number;
  p0: ScreenPoint;
  p1: ScreenPoint;
  p2: ScreenPoint;
  baseColor: RGB;
}

/**
 * Normalized device coordinate in the projection plane:
 *   - x, y in [-1, 1] after perspective divide
 *   - depth is camera-space Y (forward distance)
 *
 * Mapping to pixel coordinates is done separately via `ndcToScreen`.
 */
export interface NdcPoint {
  x: number;
  y: number;
  depth: number;
}

export interface Renderable {
  mesh: Mesh;
  worldPoints: Vec3[];
  lineWidth: number;
  baseColor: RGB;
}

export interface ScreenPoint {
  x: number;
  y: number;
  depth: number; // camera-space depth (positive means in front of camera)
}

export interface ViewConfig {
  view: View;
  debugOverlay?: ViewDebugOverlay;
  referencePlane: {
    id: string;
    position: Vec3;
    velocity: Vec3;
  };
  drawMode: DrawMode;
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
  profiler: Profiler;
};
