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
  [number, number, number],
];

/**
 * Generalized world-state container for dynamic entities.
 *
 * This is the core simulation model. Outer layers adapt this into
 * whatever representation they need for rendering or I/O.
 */
export interface DomainWorld {
  planes: PlaneBody[];
  cameras: DomainCameraPose[];
  planets: CelestialBody[];
  planetPhysics: PlanetPhysics[];
  stars: CelestialBody[];
  starPhysics: StarPhysics[];
}

export interface DomainCameraPose {
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

export interface BodyState {
  id: BodyId;
  velocity: Vec3;
  mass: number;
}

/**
 * Container for all gravitational bodies in the domain.
 */
export interface GravityState {
  bodies: BodyState[];
  bindings: GravityBodyBinding[];
  mainPlaneBodyIndex: number;
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
    state: GravityState,
  ): GravityState;
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
 * Domain-level airplane/ship body.
 */
export interface PlaneBody {
  id: string;
  position: Vec3;
  frame: LocalFrame;
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
export interface StarPhysics extends PlanetPhysics {
  luminosity: number; // W or scaled units for lighting
}

export interface PlanetPathMapping {
  planetId: string;
  pathId: string;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
