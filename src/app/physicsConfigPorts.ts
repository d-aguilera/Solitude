import type { BodyId } from "../domain/domainPorts.js";

export type CelestialBodyKind = "planet" | "star";

export interface CelestialBodyPhysicsConfig {
  id: string; // domain id, e.g. "planet:earth"
  kind: CelestialBodyKind;

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

  /**
   * ID of the central body that dominates this orbit.
   *
   * For heliocentric planetary orbits this is the Sun's id.
   * For moons this is the id of the parent planet.
   * For a root body (e.g. Sun at origin) this should be equal to its own id.
   */
  centralBodyId: BodyId;

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

export interface PlanetPhysicsConfig extends CelestialBodyPhysicsConfig {
  kind: "planet";
}

export interface StarPhysicsConfig extends CelestialBodyPhysicsConfig {
  kind: "star";
  luminosity: number; // W (or scaled W) for stars
}

export interface ShipPhysicsConfig {
  altitude: number;
  density: number; // kg/m^3
  homePlanetId: string;
  id: string;
  volume: number; // m^3, derived from hull mesh
}

export interface WorldPhysicsConfig {
  planets: (PlanetPhysicsConfig | StarPhysicsConfig)[];
  ships: ShipPhysicsConfig[];
}
