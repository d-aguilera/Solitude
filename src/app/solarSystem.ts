import type { StarBodyConfig } from "./appInternals.js";
import type { PlanetBodyConfig } from "./appInternals.js";
import { colors } from "./appInternals.js";
import { vec3 } from "../domain/vec3.js";
import type { KeplerianOrbit } from "../domain/domainPorts.js";

const AU = 1.495978707e11; // m

// Base SI unit helpers
const km = 1_000;

// Sun mass (for heliocentric orbits)
const M_SUN = 1.98847e30; // kg

const twoPi = 2 * Math.PI;

// Real(ish) semi‑major axes (meters)
const orbits = {
  mercury: 0.387 * AU,
  venus: 0.723 * AU,
  earth: 1.0 * AU,
  mars: 1.524 * AU,
  jupiter: 5.203 * AU,
  saturn: 9.537 * AU,
  uranus: 19.191 * AU,
  neptune: 30.07 * AU,
};

// Approximate orbital eccentricities (dimensionless)
const eccentricities = {
  mercury: 0.2056,
  venus: 0.0068,
  earth: 0.0167,
  mars: 0.0934,
  jupiter: 0.0489,
  saturn: 0.0565,
  uranus: 0.0463,
  neptune: 0.0095,
};

// Real planetary mean radii (meters)
const radii = {
  sun: 696_340 * km,
  mercury: 2_439.7 * km,
  venus: 6_051.8 * km,
  earth: 6_371.0 * km,
  mars: 3_389.5 * km,
  jupiter: 69_911 * km,
  saturn: 58_232 * km,
  uranus: 25_362 * km,
  neptune: 24_622 * km,
};

// Approximate mean densities (kg/m^3)
const densities = {
  sun: 1_408,
  mercury: 5_427,
  venus: 5_243,
  earth: 5_514,
  mars: 3_933,
  jupiter: 1_326,
  saturn: 687,
  uranus: 1_270,
  neptune: 1_638,
};

// Bolometric luminosities (W)
const luminosities = {
  sun: 3.828e26,
};

// Approximate sidereal rotation periods in seconds (sign encodes direction).
const spinPeriodsSeconds = {
  sun: 25.05 * 24 * 3600,
  mercury: 58.6 * 24 * 3600,
  venus: -243 * 24 * 3600, // retrograde
  earth: 23.934 * 3600,
  mars: 24.6 * 3600,
  jupiter: 9.93 * 3600,
  saturn: 10.7 * 3600,
  uranus: -17.2 * 3600, // retrograde
  neptune: 16.1 * 3600,
};

// Axial tilts (obliquity) in degrees, relative to each planet's orbital normal.
const obliquitiesDeg = {
  sun: 7.25,
  mercury: 0.03,
  venus: 177.4, // almost upside down, retrograde
  earth: 23.44,
  mars: 25.19,
  jupiter: 3.13,
  saturn: 26.73,
  uranus: 97.77, // nearly on its side
  neptune: 28.32,
};

/**
 * Approximate orbital inclinations (degrees) relative to a reference plane.
 * Here we treat the ecliptic as the reference, and interpret these angles
 * as inclination of each orbital plane relative to the global +Z axis.
 */
const inclinationsDeg = {
  mercury: 7.0,
  venus: 3.4,
  earth: 0.0,
  mars: 1.85,
  jupiter: 1.3,
  saturn: 2.5,
  uranus: 0.8,
  neptune: 1.8,
};

/**
 * Approximate longitudes of ascending node (degrees).
 *
 * These angles, together with inclinations and arguments of periapsis,
 * define the full 3D orientation of each Keplerian orbit.
 *
 * Values used here are rough and not tied to a particular epoch; they are
 * intended to produce visually plausible relative orientations.
 */
const lonAscNodeDeg = {
  mercury: 48.3,
  venus: 76.7,
  earth: 0.0,
  mars: 49.6,
  jupiter: 100.5,
  saturn: 113.7,
  uranus: 74.0,
  neptune: 131.8,
};

/**
 * Approximate arguments of periapsis (degrees).
 */
const argPeriapsisDeg = {
  mercury: 29.1,
  venus: 54.9,
  earth: 102.9,
  mars: 286.5,
  jupiter: 275.1,
  saturn: 336.0,
  uranus: 96.7,
  neptune: 265.6,
};

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function angularSpeedFromPeriod(periodSeconds: number): number {
  if (periodSeconds === 0) return 0;
  return (2 * Math.PI) / periodSeconds;
}

/**
 * Build a unit spin axis given an obliquity (tilt) angle in degrees relative
 * to the planet's orbital normal.
 *
 * The specific azimuthal orientation of the tilt within the orbital plane
 * is not modeled here; we place the tilt in a convenient plane and rely on
 * the orbit orientation to define the rest.
 */
function spinAxisFromTiltDegrees(tiltDeg: number) {
  const tiltRad = degToRad(tiltDeg);
  const x = Math.sin(tiltRad);
  const z = Math.cos(tiltRad);
  return vec3.create(x, 0, z);
}

/**
 * Helper to build a simple KeplerianOrbit for a heliocentric planet.
 *
 * meanAnomalyAtEpochRad is chosen to distribute planets around the Sun
 * without targeting a specific historical epoch.
 */
function buildPlanetOrbit(
  semiMajorAxis: number,
  eccentricity: number,
  inclinationDeg: number,
  lonAscNodeDegVal: number,
  argPeriapsisDegVal: number,
  meanAnomalyAtEpochRad: number,
): KeplerianOrbit {
  return {
    semiMajorAxis,
    eccentricity,
    inclinationRad: degToRad(inclinationDeg),
    lonAscNodeRad: degToRad(lonAscNodeDegVal),
    argPeriapsisRad: degToRad(argPeriapsisDegVal),
    meanAnomalyAtEpochRad,
  };
}

/**
 * Build a simplified solar system.
 *
 * - Sizes are roughly proportional to real radii.
 * - Densities and masses are near-realistic for each body class.
 * - Initial positions and velocities are derived from Keplerian orbital
 *   elements relative to a central mass using a two-body approximation.
 *
 * All distances and radii are in meters.
 */
export function buildDefaultSolarSystemConfigs(): (
  | PlanetBodyConfig
  | StarBodyConfig
)[] {
  return [
    // Sun at origin; treated as central body for planetary orbits.
    {
      id: "planet:sun",
      pathId: "path:planet:sun",
      kind: "star",
      orbit: {
        semiMajorAxis: 0,
        eccentricity: 0,
        inclinationRad: 0,
        lonAscNodeRad: 0,
        argPeriapsisRad: 0,
        meanAnomalyAtEpochRad: 0,
      },
      physicalRadius: radii.sun,
      density: densities.sun,
      centralMassKg: M_SUN,
      color: colors.sun,
      luminosity: luminosities.sun,
      rotationAxis: spinAxisFromTiltDegrees(obliquitiesDeg.sun),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.sun),
    },
    {
      id: "planet:mercury",
      pathId: "path:planet:mercury",
      kind: "planet",
      orbit: buildPlanetOrbit(
        orbits.mercury,
        eccentricities.mercury,
        inclinationsDeg.mercury,
        lonAscNodeDeg.mercury,
        argPeriapsisDeg.mercury,
        0 * (twoPi / 8),
      ),
      physicalRadius: radii.mercury,
      density: densities.mercury,
      centralMassKg: M_SUN,
      color: colors.mercury,
      rotationAxis: spinAxisFromTiltDegrees(obliquitiesDeg.mercury),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.mercury),
    },
    {
      id: "planet:venus",
      pathId: "path:planet:venus",
      kind: "planet",
      orbit: buildPlanetOrbit(
        orbits.venus,
        eccentricities.venus,
        inclinationsDeg.venus,
        lonAscNodeDeg.venus,
        argPeriapsisDeg.venus,
        1 * (twoPi / 8),
      ),
      physicalRadius: radii.venus,
      density: densities.venus,
      centralMassKg: M_SUN,
      color: colors.venus,
      rotationAxis: spinAxisFromTiltDegrees(obliquitiesDeg.venus),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.venus),
    },
    {
      id: "planet:earth",
      pathId: "path:planet:earth",
      kind: "planet",
      orbit: buildPlanetOrbit(
        orbits.earth,
        eccentricities.earth,
        inclinationsDeg.earth,
        lonAscNodeDeg.earth,
        argPeriapsisDeg.earth,
        2 * (twoPi / 8),
      ),
      physicalRadius: radii.earth,
      density: densities.earth,
      centralMassKg: M_SUN,
      color: colors.earth,
      rotationAxis: spinAxisFromTiltDegrees(obliquitiesDeg.earth),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.earth),
    },
    {
      id: "planet:mars",
      pathId: "path:planet:mars",
      kind: "planet",
      orbit: buildPlanetOrbit(
        orbits.mars,
        eccentricities.mars,
        inclinationsDeg.mars,
        lonAscNodeDeg.mars,
        argPeriapsisDeg.mars,
        3 * (twoPi / 8),
      ),
      physicalRadius: radii.mars,
      density: densities.mars,
      centralMassKg: M_SUN,
      color: colors.mars,
      rotationAxis: spinAxisFromTiltDegrees(obliquitiesDeg.mars),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.mars),
    },
    {
      id: "planet:jupiter",
      pathId: "path:planet:jupiter",
      kind: "planet",
      orbit: buildPlanetOrbit(
        orbits.jupiter,
        eccentricities.jupiter,
        inclinationsDeg.jupiter,
        lonAscNodeDeg.jupiter,
        argPeriapsisDeg.jupiter,
        4 * (twoPi / 8),
      ),
      physicalRadius: radii.jupiter,
      density: densities.jupiter,
      centralMassKg: M_SUN,
      color: colors.jupiter,
      rotationAxis: spinAxisFromTiltDegrees(obliquitiesDeg.jupiter),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.jupiter),
    },
    {
      id: "planet:saturn",
      pathId: "path:planet:saturn",
      kind: "planet",
      orbit: buildPlanetOrbit(
        orbits.saturn,
        eccentricities.saturn,
        inclinationsDeg.saturn,
        lonAscNodeDeg.saturn,
        argPeriapsisDeg.saturn,
        5 * (twoPi / 8),
      ),
      physicalRadius: radii.saturn,
      density: densities.saturn,
      centralMassKg: M_SUN,
      color: colors.saturn,
      rotationAxis: spinAxisFromTiltDegrees(obliquitiesDeg.saturn),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.saturn),
    },
    {
      id: "planet:uranus",
      pathId: "path:planet:uranus",
      kind: "planet",
      orbit: buildPlanetOrbit(
        orbits.uranus,
        eccentricities.uranus,
        inclinationsDeg.uranus,
        lonAscNodeDeg.uranus,
        argPeriapsisDeg.uranus,
        6 * (twoPi / 8),
      ),
      physicalRadius: radii.uranus,
      density: densities.uranus,
      centralMassKg: M_SUN,
      color: colors.uranus,
      rotationAxis: spinAxisFromTiltDegrees(obliquitiesDeg.uranus),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.uranus),
    },
    {
      id: "planet:neptune",
      pathId: "path:planet:neptune",
      kind: "planet",
      orbit: buildPlanetOrbit(
        orbits.neptune,
        eccentricities.neptune,
        inclinationsDeg.neptune,
        lonAscNodeDeg.neptune,
        argPeriapsisDeg.neptune,
        7 * (twoPi / 8),
      ),
      physicalRadius: radii.neptune,
      density: densities.neptune,
      centralMassKg: M_SUN,
      color: colors.neptune,
      rotationAxis: spinAxisFromTiltDegrees(obliquitiesDeg.neptune),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.neptune),
    },
  ];
}
