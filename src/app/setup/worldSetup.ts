import type {
  BodyId,
  KeplerianOrbit,
  World,
} from "../../domain/domainPorts.js";
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
import { buildLightsFromStars } from "../syncSceneObjects.js";
import { updateTrajectories } from "../trajectories.js";
import { getShipById } from "../worldLookup.js";
import {
  createInitialPilotCamera,
  createInitialTopCamera,
} from "./setupCameras.js";
import { addPlanetsAndStarsFromConfig } from "./setupPlanets.js";
import { addShipsFromConfig } from "./setupShips.js";
import { createTrajectories } from "./setupTrajectories.js";

export const initialFrame: LocalFrame = localFrame.fromUp(vec3.create(0, 0, 1));

export function createWorldAndScene({
  planets: planetConfigs,
  ships: shipConfigs,
  mainShipId,
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

  addPlanetsAndStarsFromConfig(planetConfigs, scene, world);
  addShipsFromConfig(shipConfigs, scene, world);

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

  updateTrajectories(0, trajectories);

  // Build initial point lights from star bodies.
  buildLightsFromStars(world, scene);

  return {
    scene,
    world,
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
export function orbitalEllipseLength(orbit: KeplerianOrbit): number {
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
