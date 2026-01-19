/**
 * ID of a logical body participating in gravity.
 */
export type BodyId = string;

export interface BodyState {
  id: BodyId;
  velocity: Vec3;
  mass: number;
}

/**
 * Logical celestial body that participates in physics / gravity.
 */
export interface CelestialBody {
  id: string;
  position: Vec3;
  velocity: Vec3;
}

export interface DomainCameraPose {
  id: string;
  position: Vec3;
  frame: LocalFrame;
}

/**
 * Generalized world-state container for dynamic entities controlled by
 * the domain logic.
 */
export interface DomainWorld {
  shipBodies: ShipBody[];
  cameras: DomainCameraPose[];
  planets: CelestialBody[];
  planetPhysics: PlanetPhysics[];
  stars: CelestialBody[];
  starPhysics: StarPhysics[];
}

/**
 * Binding between domain bodies and indices in the DomainWorld.
 *
 * Adapters are responsible for honoring these indices when mutating
 * their own world representations.
 */
export interface GravityBodyBinding {
  id: BodyId;
  kind: "ship" | "planet" | "star";
  shipIndex: number;
  planetIndex: number;
  starIndex: number;
}

/**
 * Domain-level abstraction for gravitational integration.
 *
 * Implementations stay port-pure: they do not know about rendering,
 * input, or adapter- or world-level types.
 *
 * The engine operates purely on a GravityState and returns updated
 * velocities and positions for each body.
 */
export interface GravityEngine {
  /**
   * Advance gravity simulation by dtSeconds, returning a new GravityState
   * and updated positions for each body.
   *
   * Implementations must be side‑effect free with respect to the passed
   * GravityState. Adapter layers are responsible for writing positions
   * back into their own world representations.
   */
  step(
    dtSeconds: number,
    state: GravityState,
  ): { nextState: GravityState; positions: Vec3[] };
}

/**
 * Container for all gravitational bodies in the domain.
 */
export interface GravityState {
  bodies: BodyState[];
  bindings: GravityBodyBinding[];
  positions: Vec3[];
}

export interface LocalFrame {
  right: Vec3;
  forward: Vec3;
  up: Vec3;
}

export type Mat3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
];

export interface Mesh {
  points: Vec3[];
  faces: number[][];
  faceNormals?: Vec3[];
}

/**
 * Domain-level ship body.
 */
export interface ShipBody {
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
 * Adapter-level mapping between planet ids and their trajectory path ids.
 */
export interface PlanetPathMapping {
  planetId: string;
  pathId: string;
}

/**
 * Measurement-only profiling interface.
 */
export interface Profiler {
  /**
   * Time a function and register its duration in an implementation-defined way.
   */
  run: <T>(group: string, name: string, fn: () => T) => T;

  /**
   * Increment a counter in the given group.
   */
  increment: (group: string, name: string, count?: number) => void;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Physical properties of a star body.
 */
export interface StarPhysics extends PlanetPhysics {
  luminosity: number; // W or scaled units for lighting
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
