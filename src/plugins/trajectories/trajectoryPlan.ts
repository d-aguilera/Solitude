import type { EntityConfig, KeplerianOrbit } from "../../app/configPorts";
import type { World } from "../../domain/domainPorts";
import { vec3 } from "../../domain/vec3";

export interface TrajectoryPlan {
  pathId: string;
  capacity: number;
  intervalMillis: number;
}

export const TRAJECTORY_ID_PREFIX = "traj:";

const SHIP_TRAJECTORY_PREFIX = `${TRAJECTORY_ID_PREFIX}ship:`;
const PLANET_TRAJECTORY_PREFIX = `${TRAJECTORY_ID_PREFIX}planet:`;

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
  world: World,
  entityConfigs: EntityConfig[],
): TrajectoryPlan[] {
  const plan: TrajectoryPlan[] = [];

  for (const ship of world.controllableBodies) {
    plan.push({
      pathId: trajectoryIdForShip(ship.id),
      capacity: 3 * 24 * 10, // 720 point capacity = 10 days
      intervalMillis: 20 * 60 * 1000, // 20-minute interval = 72 samples per day
    });
  }

  // Build trajectories for planets (skip moons)
  for (const cfg of getTrajectoryPlanetConfigs(entityConfigs)) {
    if (cfg.kind !== "planet" || cfg.centralBodyId !== "planet:sun") continue;
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

function getTrajectoryPlanetConfigs(configs: EntityConfig[]): {
  centralBodyId: string;
  id: string;
  kind: "planet" | "star";
  orbit: KeplerianOrbit;
}[] {
  const planetConfigs: {
    centralBodyId: string;
    id: string;
    kind: "planet" | "star";
    orbit: KeplerianOrbit;
  }[] = [];
  for (const entity of configs) {
    if (
      entity.metadata?.legacyKind !== "planet" &&
      entity.metadata?.legacyKind !== "star"
    ) {
      continue;
    }
    const state = entity.components.state;
    if (!state || state.kind !== "keplerian") continue;

    planetConfigs.push({
      centralBodyId: state.centralEntityId,
      id: entity.id,
      kind: entity.metadata.legacyKind,
      orbit: state.orbit,
    });
  }

  return planetConfigs;
}

function getById<T extends { id: string }>(
  list: T[],
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
