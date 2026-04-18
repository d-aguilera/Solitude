import type { WorldAndSceneConfig } from "../app/configPorts";
import { getShipById } from "../app/worldLookup";
import type { ShipBody, World } from "../domain/domainPorts";
import { type LocalFrame, localFrame } from "../domain/localFrame";
import { vec3 } from "../domain/vec3";
import { addPlanetsAndStarsFromConfig } from "./setupPlanets";
import { addShipsFromConfig } from "./setupShips";

export const initialFrame: LocalFrame = localFrame.fromUp(vec3.create(0, 0, 1));

export interface WorldSetup {
  enemyShip: ShipBody;
  mainShip: ShipBody;
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

  return {
    enemyShip,
    mainShip,
    world,
  };
}

/**
 * Headless world constructor intended for tests and non-rendered runs.
 */
export function createHeadlessWorld(config: WorldConfigBase): WorldSetup {
  return createWorld(config);
}
