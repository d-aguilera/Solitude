import type { KeplerianOrbit } from "../domain/domainPorts.js";
import type { PlanetBodyConfig, StarBodyConfig } from "./appInternals.js";
import { colors } from "./appInternals.js";

const AU = 1.495978707e11; // m

// Base SI unit helpers
const km = 1_000;

// Sun mass (for heliocentric orbits)
const M_SUN = 1.98847e30; // kg

// --- Generated from JPL Horizons at epoch J2000.0 ---

// Real(ish) semi‑major axes (meters)
const orbits = {
  mercury: 0.387098212184 * AU,
  venus: 0.72332692748 * AU,
  earth: 1.000448828934 * AU,
  mars: 1.523678992939 * AU,
  jupiter: 5.204336211826 * AU,
  saturn: 9.581929200479 * AU,
  uranus: 19.230147659151 * AU,
  neptune: 30.093922090027 * AU,
};

// Approximate orbital eccentricities (dimensionless)
const eccentricities = {
  mercury: 0.20563029,
  venus: 0.00675579,
  earth: 0.01711863,
  mars: 0.0933151,
  jupiter: 0.04878759,
  saturn: 0.05563834,
  uranus: 0.04439277,
  neptune: 0.01120359,
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
  mercury: 7.0050143,
  venus: 3.39458965,
  earth: 0.00041811,
  mars: 1.84987648,
  jupiter: 1.30463059,
  saturn: 2.48425239,
  uranus: 0.77267578,
  neptune: 1.77021406,
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
  mercury: 48.33053855,
  venus: 76.67837412,
  earth: 135.08071826,
  mars: 49.56200566,
  jupiter: 100.49114995,
  saturn: 113.69966003,
  uranus: 74.00474643,
  neptune: 131.78387711,
};

/**
 * Approximate arguments of periapsis (degrees).
 */
const argPeriapsisDeg = {
  mercury: 29.12428166,
  venus: 55.18596703,
  earth: 326.72821886,
  mars: 286.53738309,
  jupiter: 275.06906661,
  saturn: 335.86559372,
  uranus: 96.5887248,
  neptune: 267.31580198,
};

// mean anomaly at J2000, in radians
const meanAnomalyAtEpochRad = {
  mercury: 3.050763675831,
  venus: 0.874667773088,
  earth: 6.259051875885,
  mars: 0.337834355546,
  jupiter: 0.328394643849,
  saturn: 5.592480981712,
  uranus: 2.493893561901,
  neptune: 4.64440886758,
};

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function angularSpeedFromPeriod(periodSeconds: number): number {
  if (periodSeconds === 0) return 0;
  return (2 * Math.PI) / periodSeconds;
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
      obliquityRad: degToRad(obliquitiesDeg.sun),
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
        meanAnomalyAtEpochRad.mercury,
      ),
      physicalRadius: radii.mercury,
      density: densities.mercury,
      centralMassKg: M_SUN,
      color: colors.mercury,
      obliquityRad: degToRad(obliquitiesDeg.mercury),
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
        meanAnomalyAtEpochRad.venus,
      ),
      physicalRadius: radii.venus,
      density: densities.venus,
      centralMassKg: M_SUN,
      color: colors.venus,
      obliquityRad: degToRad(obliquitiesDeg.venus),
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
        meanAnomalyAtEpochRad.earth,
      ),
      physicalRadius: radii.earth,
      density: densities.earth,
      centralMassKg: M_SUN,
      color: colors.earth,
      obliquityRad: degToRad(obliquitiesDeg.earth),
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
        meanAnomalyAtEpochRad.mars,
      ),
      physicalRadius: radii.mars,
      density: densities.mars,
      centralMassKg: M_SUN,
      color: colors.mars,
      obliquityRad: degToRad(obliquitiesDeg.mars),
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
        meanAnomalyAtEpochRad.jupiter,
      ),
      physicalRadius: radii.jupiter,
      density: densities.jupiter,
      centralMassKg: M_SUN,
      color: colors.jupiter,
      obliquityRad: degToRad(obliquitiesDeg.jupiter),
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
        meanAnomalyAtEpochRad.saturn,
      ),
      physicalRadius: radii.saturn,
      density: densities.saturn,
      centralMassKg: M_SUN,
      color: colors.saturn,
      obliquityRad: degToRad(obliquitiesDeg.saturn),
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
        meanAnomalyAtEpochRad.uranus,
      ),
      physicalRadius: radii.uranus,
      density: densities.uranus,
      centralMassKg: M_SUN,
      color: colors.uranus,
      obliquityRad: degToRad(obliquitiesDeg.uranus),
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
        meanAnomalyAtEpochRad.neptune,
      ),
      physicalRadius: radii.neptune,
      density: densities.neptune,
      centralMassKg: M_SUN,
      color: colors.neptune,
      obliquityRad: degToRad(obliquitiesDeg.neptune),
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.neptune),
    },
  ];
}
