import type {
  KeplerianOrbit,
  PlanetPhysicsConfig,
  StarPhysicsConfig,
} from "../app/physicsConfigPorts";
import type {
  PlanetRenderConfig,
  StarRenderConfig,
} from "../app/renderConfigPorts";
import type { Trajectory } from "../app/runtimePorts";
import type { PolylineSceneObject, Scene } from "../app/scenePorts";
import { getPlanetBodyById } from "../app/worldLookup";
import type { BodyId, World } from "../domain/domainPorts";
import { vec3 } from "../domain/vec3";

export function createTrajectories(
  world: World,
  { objects: sceneObjects }: Scene,
  planetPhysicsConfigs: (PlanetPhysicsConfig | StarPhysicsConfig)[],
  planetRenderConfigs: (PlanetRenderConfig | StarRenderConfig)[],
) {
  const trajectoryList: Trajectory[] = [];

  const planetPathIdById: Record<string, string> = {};
  for (let i = 0; i < planetRenderConfigs.length; i++) {
    const cfg = planetRenderConfigs[i];
    if (cfg.kind === "planet" && cfg.pathId) {
      planetPathIdById[cfg.id] = cfg.pathId;
    }
  }

  // build a scene objects lookup index
  const sceneObjectIndex: Record<BodyId, number> = {};
  for (let i = 0; i < sceneObjects.length; i++) {
    sceneObjectIndex[sceneObjects[i].id] = i;
  }

  // Build trajectories for ships
  for (let ship of world.ships) {
    const capacity = 3 * 24 * 10; // 720 point capacity = 10 days
    const intervalMillis = 20 * 60 * 1000; // 20-minute interval = 72 samples per day
    const sceneObject = sceneObjects[
      sceneObjectIndex["path:" + ship.id]
    ] as PolylineSceneObject;
    const trajectory = createTrajectory(capacity, intervalMillis, sceneObject);
    trajectoryList.push(trajectory);
  }

  // Build trajectories planets (skip moons)
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
    const sceneObject = sceneObjects[sceneObjectIndex[pathId]] as
      | PolylineSceneObject
      | undefined;
    if (!sceneObject) {
      throw new Error(`Trajectory scene object not found: ${pathId}`);
    }
    const trajectory = createTrajectory(capacity, intervalMillis, sceneObject);
    trajectoryList.push(trajectory);
  }

  return trajectoryList;
}

function createTrajectory(
  capacity: number,
  intervalMillis: number,
  sceneObject: PolylineSceneObject,
): Trajectory {
  const mesh = sceneObject.mesh;
  mesh.points = Array.from({ length: capacity }).map(() => vec3.zero());
  return {
    intervalMillis,
    remainingMillis: 0,
    sceneObject,
  };
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
