import type { BodyId, World } from "../../domain/domainPorts.js";
import { type LocalFrame, localFrame } from "../../domain/localFrame.js";
import { mat3 } from "../../domain/mat3.js";
import { vec3 } from "../../domain/vec3.js";
import type { Trajectory, WorldAndScene } from "../appInternals.js";
import type {
  Mesh,
  PolylineSceneObject,
  RGB,
  Scene,
  WorldAndSceneConfig,
} from "../appPorts.js";
import { getShipById, getStarPhysicsById } from "../worldLookup.js";
import {
  createInitialPilotCamera,
  createInitialTopCamera,
} from "./setupCameras.js";
import { addPlanetsAndStarsFromConfig } from "./setupPlanets.js";
import { addShipsFromConfig } from "./setupShips.js";
import { createTrajectories } from "./setupTrajectories.js";

export const initialFrame: LocalFrame = localFrame.fromUp(vec3.create(0, 0, 1));

export function createWorldAndScene({
  mainShipId,
  planets: planetConfigs,
  ships: shipConfigs,
}: WorldAndSceneConfig): WorldAndScene {
  const world: World = {
    shipBodies: [],
    planets: [],
    planetPhysics: [],
    stars: [],
    starPhysics: [],
  };

  const scene: Scene = {
    objects: [],
    lights: [],
  };

  addPlanetsAndStarsFromConfig(planetConfigs, world, scene);
  addShipsFromConfig(shipConfigs, world, scene);

  const mainShip = getShipById(world, mainShipId);
  const topCamera = createInitialTopCamera(mainShip);
  const pilotCamera = createInitialPilotCamera(mainShip);

  // Derive planet–path relationships
  const planetPathMappings: Record<BodyId, BodyId> = {};
  for (const cfg of planetConfigs) {
    if (cfg.kind !== "planet" || cfg.centralBodyId !== "planet:sun") continue;
    planetPathMappings[cfg.id] = cfg.pathId;
  }

  const trajectories: Record<BodyId, Trajectory> = createTrajectories(
    world,
    scene,
    planetConfigs,
    planetPathMappings,
  );

  // Build initial point lights from star bodies.
  addLightsFromStars(world, scene);

  return {
    scene,
    world,
    topCamera,
    pilotCamera,
    planetPathMappings,
    trajectories,
  };
}

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
    color,
    lineWidth: 2,
    wireframeOnly: true,
    applyTransform: false, // polyline points are in world space
    backFaceCulling: false,
    count: 0,
    tail: -1,
  };
}

/**
 * Build the array of point lights from the current star bodies.
 */
function addLightsFromStars(world: World, scene: Scene): void {
  scene.lights = world.stars.map((starBody) => {
    return {
      position: vec3.clone(starBody.position),
      intensity: getStarPhysicsById(world, starBody.id).luminosity,
    };
  });
}
