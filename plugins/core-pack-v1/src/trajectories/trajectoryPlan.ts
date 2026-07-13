import { vec3 } from "@solitude/plugin-api/math";
import type {
  ExternalEntityConfig,
  ExternalKeplerianOrbit,
  ExternalWorld,
} from "@solitude/plugin-api/plugin";

export interface TrajectoryPlan {
  pathId: string;
  capacity: number;
  intervalMillis: number;
}

export const TRAJECTORY_ID_PREFIX = "traj:";

const SHIP_TRAJECTORY_PREFIX = `${TRAJECTORY_ID_PREFIX}ship:`;
const PLANET_TRAJECTORY_PREFIX = `${TRAJECTORY_ID_PREFIX}planet:`;
const shipTrajectoryCapacity = 720;
const shipTrajectoryIntervalMillis = 2 * 60 * 1000;

export function trajectoryIdForShip(shipId: string): string {
  return `${SHIP_TRAJECTORY_PREFIX}${shipId}`;
}

export function trajectoryIdForPlanet(planetId: string): string {
  return `${PLANET_TRAJECTORY_PREFIX}${planetId}`;
}

export function parseTrajectoryId(
  id: string,
): { kind: "ship" | "planet"; targetId: string } | null {
  if (id.startsWith(SHIP_TRAJECTORY_PREFIX)) {
    return { kind: "ship", targetId: id.slice(SHIP_TRAJECTORY_PREFIX.length) };
  }
  if (id.startsWith(PLANET_TRAJECTORY_PREFIX)) {
    return {
      kind: "planet",
      targetId: id.slice(PLANET_TRAJECTORY_PREFIX.length),
    };
  }
  return null;
}

export function buildTrajectoryPlan(
  world: ExternalWorld,
  entityConfigs: readonly ExternalEntityConfig[],
): TrajectoryPlan[] {
  const plan: TrajectoryPlan[] = [];

  for (const ship of world.controllableBodies) {
    plan.push({
      pathId: trajectoryIdForShip(ship.id),
      capacity: shipTrajectoryCapacity,
      intervalMillis: shipTrajectoryIntervalMillis,
    });
  }

  // Build trajectories for planets (skip moons).
  for (const cfg of getTrajectoryPlanetConfigs(entityConfigs)) {
    if (cfg.centralEntityId !== "planet:sun") continue;
    const body = getById(world.entityStates, cfg.id, "Entity state");
    const speedMps = vec3.length(body.velocity);
    const speedMpMs = speedMps / 1000;
    const orbitLengthMeters = orbitalEllipseLength(cfg.orbit);
    const capacity = 360;
    const intervalLengthMeters = orbitLengthMeters / capacity;
    const intervalMillis = intervalLengthMeters / speedMpMs;
    plan.push({
      pathId: trajectoryIdForPlanet(cfg.id),
      capacity,
      intervalMillis,
    });
  }

  return plan;
}

function getTrajectoryPlanetConfigs(configs: readonly ExternalEntityConfig[]): {
  centralEntityId: string;
  id: string;
  orbit: ExternalKeplerianOrbit;
}[] {
  const planetConfigs: {
    centralEntityId: string;
    id: string;
    orbit: ExternalKeplerianOrbit;
  }[] = [];
  for (const entity of configs) {
    const state = entity.components.state;
    if (!state || state.kind !== "keplerian") continue;
    if (entity.components.lightEmitter) continue;

    planetConfigs.push({
      centralEntityId: state.centralEntityId,
      id: entity.id,
      orbit: state.orbit,
    });
  }

  return planetConfigs;
}

function getById<T extends { id: string }>(
  list: readonly T[],
  id: string,
  typeName: string,
): T {
  const obj = list.find((item) => item.id === id);
  if (!obj) {
    throw new Error(`${typeName} not found: ${id}`);
  }
  return obj;
}

/**
 * Approximate circumference (length) of the orbital ellipse in meters,
 * using Ramanujan's second approximation.
 *
 * Only depends on semi-major axis and eccentricity.
 */
function orbitalEllipseLength(orbit: ExternalKeplerianOrbit): number {
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
