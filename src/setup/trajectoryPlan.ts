import type {
  KeplerianOrbit,
  PlanetPhysicsConfig,
  StarPhysicsConfig,
} from "../app/physicsConfigPorts";
import type {
  PlanetRenderConfig,
  StarRenderConfig,
} from "../app/renderConfigPorts";
import { getPlanetBodyById } from "../app/worldLookup";
import type { World } from "../domain/domainPorts";
import { vec3 } from "../domain/vec3";

export interface TrajectoryPlan {
  pathId: string;
  capacity: number;
  intervalMillis: number;
}

export function buildTrajectoryPlan(
  world: World,
  planetPhysicsConfigs: (PlanetPhysicsConfig | StarPhysicsConfig)[],
  planetRenderConfigs: (PlanetRenderConfig | StarRenderConfig)[],
): TrajectoryPlan[] {
  const plan: TrajectoryPlan[] = [];

  const planetPathIdById: Record<string, string> = {};
  for (let i = 0; i < planetRenderConfigs.length; i++) {
    const cfg = planetRenderConfigs[i];
    if (cfg.kind === "planet" && cfg.pathId) {
      planetPathIdById[cfg.id] = cfg.pathId;
    }
  }

  // Build trajectories for ships
  for (const ship of world.ships) {
    plan.push({
      pathId: "path:" + ship.id,
      capacity: 3 * 24 * 10, // 720 point capacity = 10 days
      intervalMillis: 20 * 60 * 1000, // 20-minute interval = 72 samples per day
    });
  }

  // Build trajectories for planets (skip moons)
  for (const cfg of planetPhysicsConfigs) {
    if (cfg.kind !== "planet" || cfg.centralBodyId !== "planet:sun") continue;
    const pathId = planetPathIdById[cfg.id];
    if (!pathId) {
      throw new Error(`Missing pathId for planet render config: ${cfg.id}`);
    }
    const body = getPlanetBodyById(world, cfg.id);
    const speedMps = vec3.length(body.velocity);
    const speedMpMs = speedMps / 1000;
    const orbitLengthMeters = orbitalEllipseLength(cfg.orbit);
    const capacity = 360;
    const intervalLengthMeters = orbitLengthMeters / capacity;
    const intervalMillis = intervalLengthMeters / speedMpMs;
    plan.push({
      pathId,
      capacity,
      intervalMillis,
    });
  }

  return plan;
}

/**
 * Approximate circumference (length) of the orbital ellipse in meters,
 * using Ramanujan's second approximation.
 *
 * Only depends on semi-major axis and eccentricity.
 */
function orbitalEllipseLength(orbit: KeplerianOrbit): number {
  const a = orbit.semiMajorAxis;
  const e = orbit.eccentricity;

  if (e < 0 || e >= 1) {
    throw new Error(
      "Eccentricity must be in [0, 1) for a bound elliptical orbit.",
    );
  }

  const b = a * Math.sqrt(1 - e * e);
  const aMinusB = a - b;
  const aPlusB = a + b;
  const hTimes3 = (3 * (aMinusB * aMinusB)) / (aPlusB * aPlusB);

  return Math.PI * aPlusB * (1 + hTimes3 / (10 + Math.sqrt(4 - hTimes3)));
}
