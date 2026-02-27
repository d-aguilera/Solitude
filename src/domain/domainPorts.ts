import type { LocalFrame } from "./localFrame";
import type { Mat3 } from "./mat3";
import type { Vec3 } from "./vec3";

/**
 * ID of a logical body participating in gravity.
 */
export type BodyId = string;

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
  bodyStates: BodyState[];
  positions: Vec3[];
}

/**
 * Domain-level ship body.
 */
export interface ShipBody extends CelestialBody {
  frame: LocalFrame;
  orientation: Mat3;
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

/**
 * Physical properties of a star body.
 */
export interface StarPhysics extends PlanetPhysics {
  luminosity: number; // W or scaled units for lighting
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
