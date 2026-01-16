import { colors } from "./domainInternals.js";
import type { PlanetBodyConfig, StarBodyConfig } from "./domainInternals.js";
import { circularSpeedAtRadius } from "./phys.js";

export const AU = 1.495978707e11; // m

const twoPi = 2 * Math.PI;

// Base SI unit helpers
const km = 1_000;

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
    },
    {
      id: "planet:mercury",
      pathId: "path:planet:mercury",
      kind: "planet",
      orbit: { angleRad: 0 * (twoPi / 8), radius: orbits.mercury },
      physicalRadius: radii.mercury,
      tangentialSpeed: circularSpeedAtRadius(orbits.mercury),
      color: colors.mercury,
      density: densities.mercury,
    },
    {
      id: "planet:venus",
      pathId: "path:planet:venus",
      kind: "planet",
      orbit: { angleRad: 1 * (twoPi / 8), radius: orbits.venus },
      physicalRadius: radii.venus,
      tangentialSpeed: circularSpeedAtRadius(orbits.venus),
      color: colors.venus,
      density: densities.venus,
    },
    {
      id: "planet:earth",
      pathId: "path:planet:earth",
      kind: "planet",
      orbit: { angleRad: 2 * (twoPi / 8), radius: orbits.earth },
      physicalRadius: radii.earth,
      tangentialSpeed: circularSpeedAtRadius(orbits.earth),
      color: colors.earth,
      density: densities.earth,
    },
    {
      id: "planet:mars",
      pathId: "path:planet:mars",
      kind: "planet",
      orbit: { angleRad: 3 * (twoPi / 8), radius: orbits.mars },
      physicalRadius: radii.mars,
      tangentialSpeed: circularSpeedAtRadius(orbits.mars),
      color: colors.mars,
      density: densities.mars,
    },
    {
      id: "planet:jupiter",
      pathId: "path:planet:jupiter",
      kind: "planet",
      orbit: { angleRad: 4 * (twoPi / 8), radius: orbits.jupiter },
      physicalRadius: radii.jupiter,
      tangentialSpeed: circularSpeedAtRadius(orbits.jupiter),
      color: colors.jupiter,
      density: densities.jupiter,
    },
    {
      id: "planet:saturn",
      pathId: "path:planet:saturn",
      kind: "planet",
      orbit: { angleRad: 5 * (twoPi / 8), radius: orbits.saturn },
      physicalRadius: radii.saturn,
      tangentialSpeed: circularSpeedAtRadius(orbits.saturn),
      color: colors.saturn,
      density: densities.saturn,
    },
    {
      id: "planet:uranus",
      pathId: "path:planet:uranus",
      kind: "planet",
      orbit: { angleRad: 6 * (twoPi / 8), radius: orbits.uranus },
      physicalRadius: radii.uranus,
      tangentialSpeed: circularSpeedAtRadius(orbits.uranus),
      color: colors.uranus,
      density: densities.uranus,
    },
    {
      id: "planet:neptune",
      pathId: "path:planet:neptune",
      kind: "planet",
      orbit: { angleRad: 7 * (twoPi / 8), radius: orbits.neptune },
      physicalRadius: radii.neptune,
      tangentialSpeed: circularSpeedAtRadius(orbits.neptune),
      color: colors.neptune,
      density: densities.neptune,
    },
  ];
}
