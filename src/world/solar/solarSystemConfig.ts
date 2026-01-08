import { NEWTON_G } from "../physics/gravityConfig.js";
import type { Polar2D, RGB, Vec3 } from "../../world/types.js";
import { vec } from "../../world/vec3.js";

export type PlanetKind = "planet" | "star";

export interface PlanetConfig {
  id: string; // scene object id, e.g. "planet:earth"
  pathId: string; // orbit path scene object id, e.g. "path:planet:earth"
  objectType: string; // mesh.objectType, e.g. "planet-earth"
  kind: PlanetKind;

  // Physical orbital elements / body properties (SI units)
  orbit: Polar2D; // angleRad + physical radius in meters (semi-major axis, assumed circular)
  physicalRadius: number; // meters
  density: number; // kg/m^3

  // Rendering / initial kinematics
  tangentialSpeed: number; // m/s, orbital speed along local tangent
  color: RGB;
}

/**
 * Build a simplified solar system.
 *
 * - Sizes are roughly proportional to real radii.
 * - Densens are near-realistic for each body class.
 *
 * All distances and radii are in meters.
 */
export function buildDefaultSolarSystemConfigs(): PlanetConfig[] {
  const twoPi = 2 * Math.PI;

  // Base SI unit helpers
  const km = 1_000;
  const AU = 1.495978707e11; // m

  // Real(ish) semi‑major axes (meters)
  const orbitsReal = {
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
  const radiusReal = {
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

  // Use real Sun mass, not inferred from visual radius
  const M_sun = 1.98847e30; // kg

  function circularSpeedAtRadius(r: number): number {
    // v = sqrt(G * M_sun / r)
    return Math.sqrt((NEWTON_G * M_sun) / r);
  }

  return [
    // Sun at origin
    {
      id: "planet:sun",
      pathId: "path:planet:sun",
      objectType: "planet-sun",
      kind: "star",
      orbit: { angleRad: 0, radius: 0 }, // at origin
      physicalRadius: radiusReal.sun,
      tangentialSpeed: 0,
      color: { r: 255, g: 230, b: 120 },
      density: densities.sun,
    },
    {
      id: "planet:mercury",
      pathId: "path:planet:mercury",
      objectType: "planet-mercury",
      kind: "planet",
      orbit: { angleRad: 0 * (twoPi / 8), radius: orbitsReal.mercury },
      physicalRadius: radiusReal.mercury,
      tangentialSpeed: circularSpeedAtRadius(orbitsReal.mercury),
      color: { r: 180, g: 180, b: 180 },
      density: densities.mercury,
    },
    {
      id: "planet:venus",
      pathId: "path:planet:venus",
      objectType: "planet-venus",
      kind: "planet",
      orbit: { angleRad: 1 * (twoPi / 8), radius: orbitsReal.venus },
      physicalRadius: radiusReal.venus,
      tangentialSpeed: circularSpeedAtRadius(orbitsReal.venus),
      color: { r: 255, g: 220, b: 160 },
      density: densities.venus,
    },
    {
      id: "planet:earth",
      pathId: "path:planet:earth",
      objectType: "planet-earth",
      kind: "planet",
      orbit: { angleRad: 2 * (twoPi / 8), radius: orbitsReal.earth },
      physicalRadius: radiusReal.earth,
      tangentialSpeed: circularSpeedAtRadius(orbitsReal.earth),
      color: { r: 80, g: 120, b: 255 },
      density: densities.earth,
    },
    {
      id: "planet:mars",
      pathId: "path:planet:mars",
      objectType: "planet-mars",
      kind: "planet",
      orbit: { angleRad: 3 * (twoPi / 8), radius: orbitsReal.mars },
      physicalRadius: radiusReal.mars,
      tangentialSpeed: circularSpeedAtRadius(orbitsReal.mars),
      color: { r: 255, g: 80, b: 50 },
      density: densities.mars,
    },
    {
      id: "planet:jupiter",
      pathId: "path:planet:jupiter",
      objectType: "planet-jupiter",
      kind: "planet",
      orbit: { angleRad: 4 * (twoPi / 8), radius: orbitsReal.jupiter },
      physicalRadius: radiusReal.jupiter,
      tangentialSpeed: circularSpeedAtRadius(orbitsReal.jupiter),
      color: { r: 220, g: 180, b: 120 },
      density: densities.jupiter,
    },
    {
      id: "planet:saturn",
      pathId: "path:planet:saturn",
      objectType: "planet-saturn",
      kind: "planet",
      orbit: { angleRad: 5 * (twoPi / 8), radius: orbitsReal.saturn },
      physicalRadius: radiusReal.saturn,
      tangentialSpeed: circularSpeedAtRadius(orbitsReal.saturn),
      color: { r: 220, g: 200, b: 150 },
      density: densities.saturn,
    },
    {
      id: "planet:uranus",
      pathId: "path:planet:uranus",
      objectType: "planet-uranus",
      kind: "planet",
      orbit: { angleRad: 6 * (twoPi / 8), radius: orbitsReal.uranus },
      physicalRadius: radiusReal.uranus,
      tangentialSpeed: circularSpeedAtRadius(orbitsReal.uranus),
      color: { r: 160, g: 220, b: 240 },
      density: densities.uranus,
    },
    {
      id: "planet:neptune",
      pathId: "path:planet:neptune",
      objectType: "planet-neptune",
      kind: "planet",
      orbit: { angleRad: 7 * (twoPi / 8), radius: orbitsReal.neptune },
      physicalRadius: radiusReal.neptune,
      tangentialSpeed: circularSpeedAtRadius(orbitsReal.neptune),
      color: { r: 80, g: 120, b: 255 },
      density: densities.neptune,
    },
  ];
}

/**
 * Helper: compute a radial direction on a not-necessarily-axis-aligned plane
 * defined by two basis vectors.
 */
export function radialDirAtAngle(
  theta: number,
  radialAxis1: Vec3,
  radialAxis2: Vec3
): Vec3 {
  return vec.normalize({
    x: radialAxis1.x * Math.cos(theta) + radialAxis2.x * Math.sin(theta),
    y: radialAxis1.y * Math.cos(theta) + radialAxis2.y * Math.sin(theta),
    z: radialAxis1.z * Math.cos(theta) + radialAxis2.z * Math.sin(theta),
  });
}

/**
 * Helper: local tangential direction around that orbit plane.
 */
export function tangentialDirAtAngle(
  theta: number,
  radialAxis1: Vec3,
  radialAxis2: Vec3
): Vec3 {
  const t = {
    x: -radialAxis1.x * Math.sin(theta) + radialAxis2.x * Math.cos(theta),
    y: -radialAxis1.y * Math.sin(theta) + radialAxis2.y * Math.cos(theta),
    z: -radialAxis1.z * Math.sin(theta) + radialAxis2.z * Math.cos(theta),
  };
  return vec.normalize(t);
}
