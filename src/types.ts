import { ScreenPoint } from "./projection";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type Mat3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number]
];

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface Mesh {
  points: Vec3[];
  faces: number[][];
  color: RGB | string;
  lineWidth: number;
  objectType: string;
}

export interface LocalFrame {
  right: Vec3;
  forward: Vec3;
  up: Vec3;
}

export interface Plane {
  id: string;
  position: Vec3;
  orientation: Mat3;
  right: Vec3;
  forward: Vec3;
  up: Vec3;
  speed: number;
  scale: number;
  velocity: Vec3;
}

export interface Camera {
  id: string;
  position: Vec3;
  orientation: Mat3;
}

export interface PilotView {
  id: string;
  planeId: string;
  azimuth: number;
  elevation: number;
}

export interface SceneObject {
  id: string;
  mesh: Mesh;
  position: Vec3;
  orientation: Mat3;
  scale: number;
  color: string | { r: number; g: number; b: number };
  lineWidth?: number;
  width?: number;
  depth?: number;
  height?: number;
  wireframeOnly?: boolean;
}

// Small adapter that lets callers plug in any profiling / tracing / instrumentation
// without direct coupling to a concrete instrumentation API.
export type Profiler = {
  run: <T>(group: string, name: string, fn: () => T) => T;
  increment: (group: string, name: string, count?: number) => void;
};

export interface Renderable {
  mesh: Mesh;
  worldPoints: Vec3[];
  color: string;
  lineWidth: number;
}

export interface Scene {
  objects: SceneObject[];
  sunDirection: Vec3;
}

export type DrawMode = "faces" | "lines";

// Generalized world-state container for dynamic entities.
export interface WorldState {
  planes: Plane[];
  cameras: Camera[];
  pilotViews: PilotView[];
}

/**
 * A logical body participating in Newtonian gravity.
 * Could be a plane or a planet (or anything with mass).
 */
export type BodyId = string;

export interface BodyState {
  id: BodyId;
  velocity: Vec3;
  mass: number;
}

/**
 * Container for all gravitational bodies. This is kept in WorldState so the
 * physics step can update them each frame.
 */
export interface GravityState {
  bodies: BodyState[];
}

export interface View {
  projection: (p: Vec3) => ScreenPoint | null;
  cameraPos: Vec3 | null;
  // Optional debug overlay, not part of scene geometry
  debugDraw?: (
    ctx: CanvasRenderingContext2D,
    project: (p: Vec3) => ScreenPoint | null
  ) => void;
}
