import type {
  BodyId,
  KeplerianOrbit,
  LocalFrame,
  RGB,
  Vec3,
  World,
} from "../../domain/domainPorts.js";
import { localFrame } from "../../domain/localFrame.js";
import { mat3 } from "../../domain/mat3.js";
import { vec3 } from "../../domain/vec3.js";
import type { Trajectory } from "../appInternals.js";
import type {
  DomainCameraPose,
  Mesh,
  PolylineSceneObject,
  Scene,
  SceneObject,
} from "../appPorts.js";
import { buildLightsFromStars } from "../syncSceneObjects.js";
import { createTrajectory } from "../trajectories.js";
import {
  createInitialPilotCamera,
  createInitialTopCamera,
} from "./setupCameras.js";
import { addPlanetsAndStarsFromConfig } from "./setupPlanets.js";
import { createInitialShip } from "./setupShips.js";
import { buildDefaultSolarSystemConfigs } from "./solarSystem.js";

export const initialUp: Vec3 = vec3.create(0, 0, 1);
export const initialFrame: LocalFrame = localFrame.fromUp(initialUp);

export function createPolylineSceneObject(
  id: string,
  color: RGB,
): PolylineSceneObject {
  const mesh: Mesh = {
    points: [],
    faces: [],
  };
  return {
    id,
    kind: "polyline",
    mesh,
    position: vec3.zero(),
    orientation: mat3.identity,
    scale: 1,
    color,
    lineWidth: 2,
    wireframeOnly: true,
    applyTransform: false, // polyline points are in world space
    backFaceCulling: false,
  };
}

export function createInitialSceneAndWorld(): {
  scene: Scene;
  world: World;
  mainShipId: string;
  topCamera: DomainCameraPose;
  pilotCamera: DomainCameraPose;
  planetPathMappings: Record<BodyId, BodyId>;
  trajectories: Record<BodyId, Trajectory>;
} {
  const objects: SceneObject[] = [];

  const world: World = {
    shipBodies: [],
    planets: [],
    planetPhysics: [],
    stars: [],
    starPhysics: [],
  };

  // Build the whole planetary system from config
  const planetConfigs = buildDefaultSolarSystemConfigs();

  addPlanetsAndStarsFromConfig(
    planetConfigs,
    objects,
    world.planets,
    world.planetPhysics,
    world.stars,
    world.starPhysics,
  );

  const mainShip = createInitialShip(
    "ship:main",
    "planet:earth",
    objects,
    world,
  );

  const trajectories: Record<BodyId, Trajectory> = {};

  // Build a trajectory for the ship
  trajectories[mainShip.id] = createTrajectory(60 * 24, 20 * 60 * 1000);

  const topCamera = createInitialTopCamera(mainShip);
  const pilotCamera = createInitialPilotCamera(mainShip);

  const scene: Scene = {
    objects,
    lights: [],
  };

  // Derive planet–path relationships once from the configs we just used.
  const planetPathMappings: Record<BodyId, BodyId> = {};
  for (const cfg of planetConfigs) {
    if (cfg.kind !== "planet") continue;
    planetPathMappings[cfg.id] = cfg.pathId;
  }

  // Build a trajectory for each planet
  const capacity = 360;
  for (const cfg of planetConfigs) {
    if (cfg.kind !== "planet") continue;
    const body = world.planets.find((body) => body.id === cfg.id);
    if (!body) {
      throw new Error(`No body found for config: ${cfg.id}`);
    }
    const speedMps = vec3.length(body.velocity);
    const speedMpMs = speedMps / 1000;
    const orbitLengthMeters = orbitalEllipseLength(cfg.orbit);
    const intervalLengthMeters = orbitLengthMeters / capacity;
    const intervalMillis = intervalLengthMeters / speedMpMs;
    trajectories[cfg.id] = createTrajectory(capacity, intervalMillis);
    console.log({
      id: cfg.id,
      capacity,
      intervalMillis,
      intervalLengthMeters,
      orbitLengthMeters,
      speedMpMs,
      speedMps,
    });
  }

  // Build initial point lights from star bodies.
  buildLightsFromStars(world, scene);

  return {
    scene,
    world,
    mainShipId: mainShip.id,
    topCamera,
    pilotCamera,
    planetPathMappings,
    trajectories,
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
