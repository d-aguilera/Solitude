import type {
  PolylineSceneObject,
  RGB,
  Scene,
  WorldAndScene,
  WorldAndSceneConfig,
} from "../app/appPorts.js";
import { getShipById } from "../app/worldLookup.js";
import type { World } from "../domain/domainPorts.js";
import { type LocalFrame, localFrame } from "../domain/localFrame.js";
import { mat3 } from "../domain/mat3.js";
import { vec3, type Vec3 } from "../domain/vec3.js";
import { addPlanetsAndStarsFromConfig } from "./setupPlanets.js";
import { addShipsFromConfig } from "./setupShips.js";
import { createTrajectories } from "./setupTrajectories.js";

export const initialFrame: LocalFrame = localFrame.fromUp(vec3.create(0, 0, 1));

export function createWorldAndScene({
  enemyShipId,
  mainShipId,
  planets: planetConfigs,
  ships: shipConfigs,
}: WorldAndSceneConfig): WorldAndScene {
  const world: World = {
    ships: [],
    shipPhysics: [],
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

  const enemyShip = getShipById(world, enemyShipId);
  const mainShip = getShipById(world, mainShipId);
  const topCamera = { position: vec3.zero(), frame: localFrame.zero() };
  const pilotCamera = { position: vec3.zero(), frame: localFrame.zero() };

  const trajectoryList = createTrajectories(world, scene, planetConfigs);

  // Build initial point lights from star bodies.
  addLightsFromStars(world, scene);

  return {
    enemyShip,
    mainShip,
    pilotCamera,
    scene,
    topCamera,
    trajectoryList,
    world,
  };
}

export function createPolylineSceneObject(
  id: string,
  position: Vec3,
  color: RGB,
): PolylineSceneObject {
  return {
    id,
    kind: "polyline",
    mesh: { points: [], faces: [] },
    position, // alias
    orientation: mat3.identity,
    color,
    lineWidth: 2,
    wireframeOnly: true,
    applyTransform: false, // polylines are already in world space
    backFaceCulling: false,
    count: 0,
    tail: -1,
  };
}

/**
 * Add point lights on current star bodies.
 */
function addLightsFromStars(world: World, scene: Scene): void {
  const count = world.stars.length;
  for (let i = 0; i < count; i++) {
    const starBody = world.stars[i];
    const starPhysics = world.starPhysics[i];
    scene.lights.push({
      position: starBody.position, // alias
      intensity: starPhysics.luminosity,
    });
  }
}
