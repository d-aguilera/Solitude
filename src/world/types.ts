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
  faceNormals?: Vec3[];
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
  backFaceCulling: boolean;
}

export interface SolidSceneObject extends BaseSceneObject {
  applyTransform: true;
  wireframeOnly: false;
}

/**
 * Airplane visual object.
 */
export interface AirplaneSceneObject extends SolidSceneObject {
  kind: "airplane";
  backFaceCulling: false;
}

/**
 * Planet / star body included in gravity simulation.
 */
export interface PlanetSceneObject extends SolidSceneObject {
  kind: "planet";
  initialVelocity: Vec3;
  physicalRadius: number; // meters
  backFaceCulling: true;
  velocity: Vec3;
}

/**
 * Star body included in gravity simulation and also contributes light.
 */
export interface StarSceneObject extends SolidSceneObject {
  kind: "star";
  initialVelocity: Vec3;
  physicalRadius: number; // meters
  backFaceCulling: true;
  velocity: Vec3;
  luminosity: number; // W or scaled units for lighting
}

/**
 * Generic polyline / path object (orbit paths, plane trajectory).
 * World-space points; no transform applied; not part of gravity.
 */
export interface PolylineSceneObject extends BaseSceneObject {
  kind: "polyline";
  applyTransform: false;
  wireframeOnly: true;
  backFaceCulling: false;
}

/**
 * Union of all scene object variants.
 */
export type SceneObject =
  | AirplaneSceneObject
  | PlanetSceneObject
  | StarSceneObject
  | PolylineSceneObject;

// Renderer-side cache; may be attached to any SceneObject.
export type SceneObjectWithCache = SceneObject & {
  __worldPointsCache?: Vec3[];
  __cameraPointsCache?: Vec3[];
  __cameraCacheFrameId?: number;
  __worldFaceNormalsCache?: Vec3[];
  __faceNormalsFrameId?: number;
};

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

export interface PointLight {
  position: Vec3;
  /** Luminous power / intensity in arbitrary units (e.g. W or scaled W). */
  intensity: number;
}

export interface Scene {
  objects: SceneObject[];
  // Array of point lights (e.g., stars). All lighting is derived from these.
  lights: PointLight[];
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

export interface GravityBodyBinding {
  id: BodyId;
  kind: "plane" | "planet" | "star";
  // Index within the corresponding world array, e.g. world.planes[planeIndex]
  planeIndex?: number;
  planetIndex?: number;
  starIndex?: number;
}

/**
 * Container for all gravitational bodies.
 */
export interface GravityState {
  bodies: BodyState[];
  bindings: GravityBodyBinding[];
  // Index of the controlled plane's BodyState in `bodies`
  mainPlaneBodyIndex: number;
}
