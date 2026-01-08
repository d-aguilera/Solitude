import { Mat3 } from "./mat3";

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
}

export interface LocalFrame {
  right: Vec3;
  forward: Vec3;
  up: Vec3;
}

export interface Plane {
  id: string;
  position: Vec3;
  frame: LocalFrame;
  speed: number;
  scale: number;
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
}

export interface Camera {
  id: string;
  position: Vec3;
  frame: LocalFrame;
}

export interface PilotView {
  id: string;
  planeId: string;
  azimuth: number;
  elevation: number;
}

type SceneObjectKind = "airplane" | "planet" | "polyline" | "star";

/**
 * Base properties common to all scene objects.
 */
interface BaseSceneObject {
  id: string;
  kind: SceneObjectKind;
  mesh: Mesh;
  position: Vec3;
  orientation: Mat3;
  scale: number; // unit to world size
  color: RGB;
  lineWidth: number;
  wireframeOnly: boolean;
  applyTransform: boolean;
}

/**
 * Airplane visual object. Transform applied; no gravity properties here.
 * Currently we only ever create it for the main plane.
 */
export interface AirplaneSceneObject extends BaseSceneObject {
  kind: "airplane";
  applyTransform: true;
  wireframeOnly: false;
}

/**
 * Planet / star body included in gravity simulation.
 */
export interface PlanetSceneObject extends BaseSceneObject {
  kind: "planet";
  applyTransform: true;
  wireframeOnly: false;
  initialVelocity: Vec3;
  physicalRadius: number; // meters
}

/**
 * Star body included in gravity simulation and also contributes light.
 */
export interface StarSceneObject extends BaseSceneObject {
  kind: "star";
  applyTransform: true;
  wireframeOnly: false;
  initialVelocity: Vec3;
  physicalRadius: number; // meters
}

/**
 * Generic polyline / path object (orbit paths, plane trajectory).
 * World-space points; no transform applied; not part of gravity.
 */
export interface PolylineSceneObject extends BaseSceneObject {
  kind: "polyline";
  applyTransform: false;
  wireframeOnly: true;
}

/**
 * Union of all scene object variants.
 */
export type SceneObject =
  | AirplaneSceneObject
  | PlanetSceneObject
  | StarSceneObject
  | PolylineSceneObject;

// Small adapter that lets callers plug in any profiling / tracing / instrumentation
// without direct coupling to a concrete instrumentation API.
export type Profiler = {
  run: <T>(group: string, name: string, fn: () => T) => T;
  increment: (group: string, name: string, count?: number) => void;
};

export interface Renderable {
  mesh: Mesh;
  worldPoints: Vec3[];
  lineWidth: number;
  baseColor: RGB;
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
  planets: PlanetBody[];
  planetPhysics: PlanetPhysics[];
  stars: StarBody[];
  starPhysics: StarPhysics[];
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
 * Container for all gravitational bodies.
 */
export interface GravityState {
  bodies: BodyState[];
}
