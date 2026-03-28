import type { WorldAndSceneConfig } from "../app/configPorts.js";
import type { WorldAndScene } from "../app/runtimePorts.js";
import type { Scene } from "../app/scenePorts.js";
import { getShipById } from "../app/worldLookup.js";
import type { World } from "../domain/domainPorts.js";
import { type LocalFrame, localFrame } from "../domain/localFrame.js";
import { vec3 } from "../domain/vec3.js";
import { createSceneFromWorld } from "../render/sceneAdapter.js";
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

  addPlanetsAndStarsFromConfig(planetConfigs, world);
  addShipsFromConfig(shipConfigs, world);

  const scene: Scene = createSceneFromWorld(world, planetConfigs, shipConfigs);

  const enemyShip = getShipById(world, enemyShipId);
  const mainShip = getShipById(world, mainShipId);
  const topCamera = { position: vec3.zero(), frame: localFrame.zero() };
  const pilotCamera = { position: vec3.zero(), frame: localFrame.zero() };

  const trajectoryList = createTrajectories(world, scene, planetConfigs);

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
