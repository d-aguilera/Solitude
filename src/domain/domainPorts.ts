import { AU } from "./solarSystem.js";

// E = I / (4π r²)
const SUN_LUMINOSITY = 3.828e26; // W
const EARTH_ORBIT_RADIUS_2 = AU * AU;
export const E_SUN_AT_EARTH =
  SUN_LUMINOSITY / (4 * Math.PI * EARTH_ORBIT_RADIUS_2);

/**
 * A logical body participating in gravity.
 */
export type BodyId = string;

export type Mat3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number]
];

/**
 * Small adapter that lets callers plug in any profiling / tracing in
 * the domain layer without direct coupling to a concrete API.
 */
export type Profiler = {
  run: <T>(group: string, name: string, fn: () => T) => T;
  increment: (group: string, name: string, count?: number) => void;
};

/**
 * Union of all scene object variants.
 */
export type SceneObject =
  | AirplaneSceneObject
  | PlanetSceneObject
  | StarSceneObject
  | PolylineSceneObject;

/**
 * Airplane visual object.
 */
export interface AirplaneSceneObject extends SolidSceneObject {
  kind: "airplane";
  backFaceCulling: false;
}

/**
 * Base properties common to all scene objects.
 */
export interface BaseSceneObject extends DomainSceneObject {
  kind: SceneObjectKind;
  lineWidth: number;
  wireframeOnly: boolean;
  applyTransform: boolean;
  backFaceCulling: boolean;
}

export interface BodyState {
  id: BodyId;
  velocity: Vec3;
  mass: number;
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
 * Logical celestial body that participates in physics / gravity.
 */
export interface CelestialBody {
  id: string;
  position: Vec3;
  velocity: Vec3;
}

/**
 * Celestial body included in gravity simulation.
 */
export interface CelestialBodySceneObject extends SolidSceneObject {
  kind: "planet" | "star";
  initialVelocity: Vec3;
  physicalRadius: number; // meters
  backFaceCulling: true;
  velocity: Vec3;
}

export interface DomainScene {
  objects: DomainSceneObject[];
  lights: PointLight[];
}

export interface DomainSceneObject {
  id: string;
  position: Vec3;
  orientation: Mat3;
  mesh: Mesh;
  scale: number;
  color: RGB;
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
  planets: CelestialBody[];
  planetPhysics: PlanetPhysics[];
  stars: CelestialBody[];
  starPhysics: StarPhysics[];
}

export interface GravityBodyBinding {
  id: BodyId;
  kind: "plane" | "planet" | "star";
  planeIndex: number;
  planetIndex: number;
  starIndex: number;
}

/**
 * Domain-level abstraction for gravitational integration.
 *
 * The domain layer and any outer layers that need pure physics depend on this
 * port, not on a specific implementation.
 */
export interface GravityEngine {
  /**
   * Build an immutable GravityState snapshot from the given DomainWorld.
   *
   * The DomainWorld passed here should be a pure domain container, not any
   * adapter-extended world state.
   */
  buildInitialState(world: DomainWorld, mainPlaneId: string): GravityState;

  /**
   * Advance gravity simulation by dtSeconds, returning a new GravityState.
   *
   * Implementations must be side‑effect free with respect to the passed
   * DomainWorld and GravityState. Any world mutation is the responsibility
   * of an outer adapter.
   */
  step(
    dtSeconds: number,
    world: DomainWorld,
    state: GravityState
  ): GravityState;
}

/**
 * Container for all gravitational bodies in the domain.
 */
export interface GravityState {
  bodies: BodyState[];
  bindings: GravityBodyBinding[];
  mainPlaneBodyIndex: number;
}

export interface LocalFrame {
  right: Vec3;
  forward: Vec3;
  up: Vec3;
}

export interface Mesh {
  points: Vec3[];
  faces: number[][];
  faceNormals?: Vec3[];
}

/**
 * Adapter-level plane view used by app and rendering.
 *
 * This is a thin DTO around the domain PlaneBody.
 */
export interface Plane extends PlaneBody {
  speed: number;
}

/**
 * Domain-level airplane/ship body.
 */
export interface PlaneBody {
  id: string;
  position: Vec3;
  frame: LocalFrame;
  velocity: Vec3;
}

export interface PlanetPathMapping {
  planetId: string;
  pathId: string;
}

/**
 * Domain-level scene representation for lighting etc.
 * Rendering adapters can extend this with extra fields as needed.
 */
export interface PointLight {
  position: Vec3;
  intensity: number;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Adapter-level scene used by renderers.
 */
export interface Scene extends DomainScene {
  objects: SceneObject[];
}

/**
 * Adapter-level world state used by the app and renderer.
 *
 * This wraps the DomainWorld so that outer layers do not depend on
 * the raw domain container directly.
 */
export interface WorldState extends DomainWorld {
  planes: Plane[];
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
 * Planet included in gravity simulation.
 */
export interface PlanetSceneObject extends CelestialBodySceneObject {
  kind: "planet";
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

export type SceneObjectKind = "airplane" | "planet" | "polyline" | "star";

export interface SolidSceneObject extends BaseSceneObject {
  applyTransform: true;
  wireframeOnly: false;
}

/**
 * Physical properties of a star body.
 */
export interface StarPhysics extends PlanetPhysics {
  luminosity: number; // W or scaled units for lighting
}

/**
 * Star included in gravity simulation and also contributes light.
 */
export interface StarSceneObject extends CelestialBodySceneObject {
  kind: "star";
  luminosity: number; // W or scaled units for lighting
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
