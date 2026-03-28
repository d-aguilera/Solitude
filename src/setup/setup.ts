import type { WorldAndSceneConfig } from "../app/configPorts.js";
import type { DomainCameraPose } from "../app/scenePorts.js";
import { getShipById } from "../app/worldLookup.js";
import type { ShipBody, World } from "../domain/domainPorts.js";
import { type LocalFrame, localFrame } from "../domain/localFrame.js";
import { vec3 } from "../domain/vec3.js";
import { addPlanetsAndStarsFromConfig } from "./setupPlanets.js";
import { addShipsFromConfig } from "./setupShips.js";

export const initialFrame: LocalFrame = localFrame.fromUp(vec3.create(0, 0, 1));

export interface WorldSetup {
  enemyShip: ShipBody;
  mainShip: ShipBody;
  pilotCamera: DomainCameraPose;
  topCamera: DomainCameraPose;
  world: World;
}

export type WorldConfigBase = Pick<
  WorldAndSceneConfig,
  "enemyShipId" | "mainShipId" | "physics"
>;

export function createWorld({
  enemyShipId,
  mainShipId,
  physics,
}: WorldConfigBase): WorldSetup {
  const world: World = {
    ships: [],
    shipPhysics: [],
    planets: [],
    planetPhysics: [],
    stars: [],
    starPhysics: [],
  };

  addPlanetsAndStarsFromConfig(physics.planets, world);
  addShipsFromConfig(physics.ships, world);

  const enemyShip = getShipById(world, enemyShipId);
  const mainShip = getShipById(world, mainShipId);
  const topCamera = { position: vec3.zero(), frame: localFrame.zero() };
  const pilotCamera = { position: vec3.zero(), frame: localFrame.zero() };

  return {
    enemyShip,
    mainShip,
    pilotCamera,
    topCamera,
    world,
  };
}

/**
 * Headless world constructor intended for tests and non-rendered runs.
 */
export function createHeadlessWorld(config: WorldConfigBase): WorldSetup {
  return createWorld(config);
}
