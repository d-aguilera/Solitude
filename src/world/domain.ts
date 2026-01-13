import type { Mat3 } from "./mat3.js";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface Polar2D {
  angleRad: number;
  radius: number;
}

export interface Mesh {
  points: Vec3[];
  faces: number[][];
  faceNormals?: Vec3[];
}

export interface LocalFrame {
  right: Vec3;
  forward: Vec3;
  up: Vec3;
}

/**
 * Domain-level airplane/ship body.
 *
 * This is the simulation model; it does not know about rendering or
 * concrete adapter concerns like Canvas, DOM, etc.
 */
export interface PlaneBody {
  id: string;
  position: Vec3;
  frame: LocalFrame;
  velocity: Vec3;
}

/**
 * Logical planet body that participates in physics / gravity.
 */
export interface PlanetBody {
  id: string;
  position: Vec3;
  velocity: Vec3;
}

/**
 * Logical star body that participates in physics / gravity.
 */
export interface StarBody {
  id: string;
  position: Vec3;
  velocity: Vec3;
}

/**
 * Physical properties of a planet / star body.
 */
export interface PlanetPhysics {
  id: string;
  physicalRadius: number; // meters
  density: number; // kg/m^3
  mass: number; // kg (derived from radius and density)
}

/**
 * Physical properties of a star body.
 */
export interface StarPhysics {
  id: string;
  physicalRadius: number; // meters
  density: number; // kg/m^3
  mass: number; // kg
  luminosity: number; // W or scaled units for lighting
}

/**
 * Domain-level camera pose used by simulation and view configuration.
 */
export interface CameraPose {
  id: string;
  position: Vec3;
  frame: LocalFrame;
}

/**
 * Generalized world-state container for dynamic entities.
 *
 * This is the core simulation model. Outer layers adapt this into
 * whatever representation they need for rendering or I/O.
 */
export interface DomainWorld {
  planes: PlaneBody[];
  cameras: CameraPose[];
  planets: PlanetBody[];
  planetPhysics: PlanetPhysics[];
  stars: StarBody[];
  starPhysics: StarPhysics[];
}

/**
 * A logical body participating in gravity.
 */
export type BodyId = string;

export interface BodyState {
  id: BodyId;
  velocity: Vec3;
  mass: number;
}

export interface GravityBodyBinding {
  id: BodyId;
  kind: "plane" | "planet" | "star";
  planeIndex: number;
  planetIndex: number;
  starIndex: number;
}

/**
 * Container for all gravitational bodies in the domain.
 */
export interface GravityState {
  bodies: BodyState[];
  bindings: GravityBodyBinding[];
  mainPlaneBodyIndex: number;
}

/**
 * Small adapter that lets callers plug in any profiling / tracing in
 * the domain layer without direct coupling to a concrete API.
 */
export type Profiler = {
  run: <T>(group: string, name: string, fn: () => T) => T;
  increment: (group: string, name: string, count?: number) => void;
};

/**
 * Domain-level scene representation for lighting etc.
 * Rendering adapters can extend this with extra fields as needed.
 */
export interface PointLight {
  position: Vec3;
  intensity: number;
}

export interface DomainSceneObject {
  id: string;
  position: Vec3;
  orientation: Mat3;
  mesh: Mesh;
  scale: number;
  color: RGB;
}

export interface DomainScene {
  objects: DomainSceneObject[];
  lights: PointLight[];
}
