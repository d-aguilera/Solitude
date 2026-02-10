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
  mass: number;
  velocity: Vec3;
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
export interface ShipBody extends CelestialBody {
  frame: LocalFrame;
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
 * Keplerian orbital elements for a body orbiting a central mass.
 *
 * All angles are in radians.
 *
 * Frame:
 *  - The reference plane and direction are defined by the application.
 *  - a, e, i, Ω, ω, and M0 follow the standard orbital mechanics convention.
 */
export interface KeplerianOrbit {
  /** Semi-major axis (meters). */
  semiMajorAxis: number;
  /** Eccentricity in [0, 1). */
  eccentricity: number;
  /** Inclination relative to the reference plane (radians). */
  inclinationRad: number;
  /** Longitude of ascending node (radians). */
  lonAscNodeRad: number;
  /** Argument of periapsis (radians). */
  argPeriapsisRad: number;
  /** Mean anomaly at the chosen epoch (radians). */
  meanAnomalyAtEpochRad: number;
}

export interface Polar2D {
  angleRad: number;
  radius: number;
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
