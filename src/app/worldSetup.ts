import type {
  BodyId,
  LocalFrame,
  Mesh,
  RGB,
  Vec3,
  World,
} from "../domain/domainPorts.js";
import { makeLocalFrameFromUp } from "../domain/localFrame.js";
import { mat3 } from "../domain/mat3.js";
import { vec3 } from "../domain/vec3.js";
import type { PlanetTrajectory } from "./appInternals.js";
import type {
  DomainCameraPose,
  PolylineSceneObject,
  Scene,
  SceneObject,
} from "./appPorts.js";
import {
  createInitialPilotCamera,
  createInitialTopCamera,
} from "./setupCameras.js";
import { addPlanetsAndStarsFromConfig } from "./setupPlanets.js";
import { createInitialShip } from "./setupShips.js";
import { buildDefaultSolarSystemConfigs } from "./solarSystem.js";
import { buildLightsFromStars } from "./syncSceneObjects.js";
import { createPlanetTrajectory } from "./trajectories.js";

export const initialUp: Vec3 = vec3.create(0, 0, 1);
export const initialFrame: LocalFrame = makeLocalFrameFromUp(initialUp);

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
  planetTrajectories: Record<BodyId, PlanetTrajectory>;
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

  const topCamera = createInitialTopCamera(mainShip);
  const pilotCamera = createInitialPilotCamera(mainShip);

  const scene: Scene = {
    objects,
    lights: [],
  };

  // Derive planet–path relationships once from the configs we just used.
  const planetPathMappings: Record<BodyId, BodyId> = {};
  for (const cfg of planetConfigs) {
    planetPathMappings[cfg.id] = cfg.pathId;
  }

  // Build a trajectory for each planet
  const planetTrajectories: Record<BodyId, PlanetTrajectory> = {};
  for (const cfg of planetConfigs) {
    planetTrajectories[cfg.id] = createPlanetTrajectory();
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
    planetTrajectories,
  };
}
