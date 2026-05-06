import type { AngularVelocity, EntityId } from "../domain/domainPorts";
import type { LocalFrame } from "../domain/localFrame";
import type { Mat3 } from "../domain/mat3";
import type { Vec3 } from "../domain/vec3";

export interface KeplerianBodyPhysicsConfig {
  id: EntityId;

  /**
   * Keplerian orbital elements relative to a chosen central body.
   *
   * All distances are in meters and all angles are in radians.
   *
   * The application is responsible for interpreting these elements in a
   * specific reference frame and for using them to derive initial position
   * and velocity at the epoch.
   */
  orbit: KeplerianOrbit;

  // Physical body properties (SI units)
  physicalRadius: number; // meters
  density: number; // kg/m^3
  luminosity?: number; // W or scaled units for light-emitting bodies

  /**
   * ID of the central body that dominates this orbit.
   *
   * For a root body at the origin, this should be equal to its own id.
   */
  centralEntityId: EntityId;

  /**
   * Axial rotation:
   *  - obliquityRad is the angle (in radians) between the spin axis and
   *    the orbital plane normal.
   *  - angularSpeedRadPerSec is the constant spin rate around that axis.
   *
   * The application is responsible for deriving a concrete rotation axis
   * from the orbit geometry and this obliquity.
   */
  obliquityRad: number;
  angularSpeedRadPerSec: number;
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

export interface ControlledBodyPhysicsConfig {
  density: number; // kg/m^3
  id: string;
  volume: number; // m^3, derived from hull mesh
}

export interface ControlledBodyInitialStateConfig {
  angularVelocity: AngularVelocity;
  frame: LocalFrame;
  id: string;
  orientation: Mat3;
  position: Vec3;
  velocity: Vec3;
}
