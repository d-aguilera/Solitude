import type { World, BodyId } from "../../domain/domainPorts.js";
import { vec3 } from "../../domain/vec3.js";
import type { Trajectory } from "../appInternals.js";
import type {
  PlanetBodyConfig,
  PolylineSceneObject,
  Scene,
  StarBodyConfig,
} from "../appPorts.js";
import { createTrajectory } from "../trajectories.js";
import { getPlanetBodyById } from "../worldLookup.js";
import { orbitalEllipseLength } from "./worldSetup.js";

export function createTrajectories(
  world: World,
  { objects: sceneObjects }: Scene,
  planetConfigs: (PlanetBodyConfig | StarBodyConfig)[],
  planetPathMappings: Record<string, string>,
) {
  const trajectories: Record<BodyId, Trajectory> = {};

  // build a scene objects lookup index
  const sceneObjectIndex: Record<BodyId, number> = {};
  for (let i = 0; i < sceneObjects.length; i++) {
    sceneObjectIndex[sceneObjects[i].id] = i;
  }

  // Build trajectories for ships
  for (let ship of world.shipBodies) {
    trajectories[ship.id] = createTrajectory(
      3 * 24 * 10, // 720 point capacity = 10 days
      20 * 60 * 1000, // 20-minute interval = 72 samples per day
      sceneObjects[sceneObjectIndex["path:" + ship.id]] as PolylineSceneObject,
    );
  }

  // Build trajectories planets (skip moons)
  for (const cfg of planetConfigs) {
    if (cfg.kind !== "planet" || cfg.centralBodyId !== "planet:sun") continue;
    const body = getPlanetBodyById(world, cfg.id);
    const speedMps = vec3.length(body.velocity);
    const speedMpMs = speedMps / 1000;
    const orbitLengthMeters = orbitalEllipseLength(cfg.orbit);
    const capacity = 360;
    const intervalLengthMeters = orbitLengthMeters / capacity;
    const intervalMillis = intervalLengthMeters / speedMpMs;
    const sceneObject = sceneObjects[
      sceneObjectIndex[planetPathMappings[cfg.id]]
    ] as PolylineSceneObject;
    trajectories[cfg.id] = createTrajectory(
      capacity,
      intervalMillis,
      sceneObject,
    );
  }

  return trajectories;
}
