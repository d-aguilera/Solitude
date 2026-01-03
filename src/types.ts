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
  x: number;
  y: number;
  z: number;
  orientation: Mat3;
  right: Vec3;
  forward: Vec3;
  up: Vec3;
  speed: number;
  scale: number;
}

export interface Camera {
  x: number;
  y: number;
  z: number;
  orientation: Mat3;
}

export interface PilotState {
  azimuth: number;
  elevation: number;
}

export interface SceneObject {
  mesh: Mesh;
  x: number;
  y: number;
  z: number;
  orientation: Mat3;
  scale: number;
  color: string | { r: number; g: number; b: number };
  lineWidth?: number;
  width?: number;
  depth?: number;
  height?: number;
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
  planetGrid: SceneObject[];
  airplanes: SceneObject[];
  sunDirection: Vec3;
}

export type DrawMode = "faces" | "lines";
