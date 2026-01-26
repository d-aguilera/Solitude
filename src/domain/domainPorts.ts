// Gravitational constant in m^3 / (kg * s^2).
export const NEWTON_G = 6.6743e-11;

// Small softening term to avoid singularities when bodies get very close.
export const SOFTENING_LENGTH = 1.0;

/**
 * ID of a logical body participating in gravity.
 */
export type BodyId = string;

export type PlanetKind = "planet" | "star";

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

/**
 * Shared configuration for bodies that participate in orbits.
 */
export interface CelestialBodyConfig {
  id: string; // domain id, e.g. "planet:earth"
  pathId: string; // orbit path id, purely logical association
  kind: PlanetKind;

  // Physical orbital elements / body properties (SI units)
  orbit: Polar2D; // angleRad + physical radius in meters (semi-major axis, assumed circular)
  physicalRadius: number; // meters
  density: number; // kg/m^3

  // Rendering / initial kinematics
  tangentialSpeed: number; // m/s, orbital speed along local tangent
  color: RGB;

  /**
   * Axial rotation:
   *  - rotationAxis is a unit vector in world space (e.g. approximate spin axis)
   *  - angularSpeedRadPerSec is the constant spin rate around that axis
   */
  rotationAxis: { x: number; y: number; z: number };
  angularSpeedRadPerSec: number;
}

/**
 * Domain-level abstraction for gravitational integration.
 */
export interface GravityEngine {
  /**
   * Advance gravity simulation by dtSeconds.
   */
  step(dtSeconds: number, state: GravityState): void;
}

/**
 * Container for all gravitational bodies in the domain.
 */
export interface GravityState {
  bodies: BodyState[];
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

export interface PlanetBodyConfig extends CelestialBodyConfig {
  kind: "planet";
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

export interface Polar2D {
  angleRad: number;
  radius: number;
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

export interface StarBodyConfig extends CelestialBodyConfig {
  kind: "star";
  luminosity: number; // W (or scaled W) for stars
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

/**
 * Generalized world-state container for dynamic entities controlled by
 * the domain logic.
 */
export interface World {
  shipBodies: ShipBody[];
  planets: CelestialBody[];
  planetPhysics: PlanetPhysics[];
  stars: CelestialBody[];
  starPhysics: StarPhysics[];
}
export const colors: { [key: string]: RGB } = {
  ship: { r: 0, g: 255, b: 255 },
  earth: { r: 80, g: 120, b: 255 },
  jupiter: { r: 220, g: 180, b: 120 },
  mars: { r: 255, g: 80, b: 50 },
  mercury: { r: 180, g: 180, b: 180 },
  neptune: { r: 80, g: 120, b: 255 },
  saturn: { r: 220, g: 200, b: 150 },
  sun: { r: 255, g: 230, b: 120 },
  uranus: { r: 160, g: 220, b: 240 },
  venus: { r: 255, g: 220, b: 160 },
  yellow: { r: 255, g: 255, b: 0 },
};
