import type { RGB } from "./domainPorts.js";

// Sun mass (for heliocentric orbits)
export const M_SUN = 1.98847e30; // kg

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

export type PlanetKind = "planet" | "star";

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

export interface PlanetBodyConfig extends CelestialBodyConfig {
  kind: "planet";
}

export interface Polar2D {
  angleRad: number;
  radius: number;
}

export interface StarBodyConfig extends CelestialBodyConfig {
  kind: "star";
  luminosity: number; // W (or scaled W) for stars
}
