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
 * Celestial body with persistent axial spin state.
 */
export interface RotatingBody extends CelestialBody {
  orientation: Mat3;
  rotationAxis: Vec3;
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
  bodyStates: BodyState[];
  positions: Vec3[];
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
 * Domain-level ship body.
 */
export interface ShipBody extends CelestialBody {
  frame: LocalFrame;
  orientation: Mat3;
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
  ships: ShipBody[];
  planets: RotatingBody[];
  planetPhysics: PlanetPhysics[];
  stars: RotatingBody[];
  starPhysics: StarPhysics[];
}
