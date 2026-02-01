import type { StarBodyConfig } from "./appInternals.js";
import type { PlanetBodyConfig } from "./appInternals.js";
import { circularSpeedAtRadius } from "../domain/phys.js";
import { colors } from "./appInternals.js";
import { vec3 } from "../domain/vec3.js";

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

function angularSpeedFromPeriod(periodSeconds: number): number {
  if (periodSeconds === 0) return 0;
  return (2 * Math.PI) / periodSeconds;
}

/**
 * Build a simplified solar system.
 *
 * - Sizes are roughly proportional to real radii.
 * - Densens are near-realistic for each body class.
 *
 * All distances and radii are in meters.
 */
export function buildDefaultSolarSystemConfigs(): (
  | PlanetBodyConfig
  | StarBodyConfig
)[] {
  const spinAxis = vec3.create(0, 0, 1);

  return [
    // Sun at origin
    {
      id: "planet:sun",
      pathId: "path:planet:sun",
      kind: "star",
      orbit: { angleRad: 0, radius: 0 }, // at origin
      physicalRadius: radii.sun,
      tangentialSpeed: 0,
      color: colors.sun,
      density: densities.sun,
      luminosity: luminosities.sun,
      rotationAxis: spinAxis,
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.sun),
    },
    {
      id: "planet:mercury",
      pathId: "path:planet:mercury",
      kind: "planet",
      orbit: { angleRad: 0 * (twoPi / 8), radius: orbits.mercury },
      physicalRadius: radii.mercury,
      tangentialSpeed: circularSpeedAtRadius(M_SUN, orbits.mercury),
      color: colors.mercury,
      density: densities.mercury,
      rotationAxis: spinAxis,
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.mercury),
    },
    {
      id: "planet:venus",
      pathId: "path:planet:venus",
      kind: "planet",
      orbit: { angleRad: 1 * (twoPi / 8), radius: orbits.venus },
      physicalRadius: radii.venus,
      tangentialSpeed: circularSpeedAtRadius(M_SUN, orbits.venus),
      color: colors.venus,
      density: densities.venus,
      rotationAxis: spinAxis,
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.venus),
    },
    {
      id: "planet:earth",
      pathId: "path:planet:earth",
      kind: "planet",
      orbit: { angleRad: 2 * (twoPi / 8), radius: orbits.earth },
      physicalRadius: radii.earth,
      tangentialSpeed: circularSpeedAtRadius(M_SUN, orbits.earth),
      color: colors.earth,
      density: densities.earth,
      rotationAxis: spinAxis,
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.earth),
    },
    {
      id: "planet:mars",
      pathId: "path:planet:mars",
      kind: "planet",
      orbit: { angleRad: 3 * (twoPi / 8), radius: orbits.mars },
      physicalRadius: radii.mars,
      tangentialSpeed: circularSpeedAtRadius(M_SUN, orbits.mars),
      color: colors.mars,
      density: densities.mars,
      rotationAxis: spinAxis,
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.mars),
    },
    {
      id: "planet:jupiter",
      pathId: "path:planet:jupiter",
      kind: "planet",
      orbit: { angleRad: 4 * (twoPi / 8), radius: orbits.jupiter },
      physicalRadius: radii.jupiter,
      tangentialSpeed: circularSpeedAtRadius(M_SUN, orbits.jupiter),
      color: colors.jupiter,
      density: densities.jupiter,
      rotationAxis: spinAxis,
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.jupiter),
    },
    {
      id: "planet:saturn",
      pathId: "path:planet:saturn",
      kind: "planet",
      orbit: { angleRad: 5 * (twoPi / 8), radius: orbits.saturn },
      physicalRadius: radii.saturn,
      tangentialSpeed: circularSpeedAtRadius(M_SUN, orbits.saturn),
      color: colors.saturn,
      density: densities.saturn,
      rotationAxis: spinAxis,
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.saturn),
    },
    {
      id: "planet:uranus",
      pathId: "path:planet:uranus",
      kind: "planet",
      orbit: { angleRad: 6 * (twoPi / 8), radius: orbits.uranus },
      physicalRadius: radii.uranus,
      tangentialSpeed: circularSpeedAtRadius(M_SUN, orbits.uranus),
      color: colors.uranus,
      density: densities.uranus,
      rotationAxis: spinAxis,
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.uranus),
    },
    {
      id: "planet:neptune",
      pathId: "path:planet:neptune",
      kind: "planet",
      orbit: { angleRad: 7 * (twoPi / 8), radius: orbits.neptune },
      physicalRadius: radii.neptune,
      tangentialSpeed: circularSpeedAtRadius(M_SUN, orbits.neptune),
      color: colors.neptune,
      density: densities.neptune,
      rotationAxis: spinAxis,
      angularSpeedRadPerSec: angularSpeedFromPeriod(spinPeriodsSeconds.neptune),
    },
  ];
}
