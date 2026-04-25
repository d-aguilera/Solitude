import type { WorldAndSceneConfig } from "../app/configPorts";
import { getShipById } from "../app/worldLookup";
import type { ShipBody, World } from "../domain/domainPorts";
import { type LocalFrame, localFrame } from "../domain/localFrame";
import { vec3 } from "../domain/vec3";
import { addPlanetsAndStarsFromConfig } from "./setupPlanets";
import { addShipsFromConfig } from "./setupShips";

export const initialFrame: LocalFrame = localFrame.fromUp(vec3.create(0, 0, 1));

export interface WorldSetup {
  mainShip: ShipBody;
  world: World;
}

export type WorldConfigBase = Pick<
  WorldAndSceneConfig,
  "mainShipId" | "physics"
>;

export function createWorld({
  mainShipId,
  physics,
}: WorldConfigBase): WorldSetup {
  validateWorldConfig({ mainShipId, physics });

  const world: World = {
    ships: [],
    shipPhysics: [],
    planets: [],
    planetPhysics: [],
    stars: [],
    starPhysics: [],
  };

  addPlanetsAndStarsFromConfig(physics.planets, world);
  addShipsFromConfig(physics.ships, physics.shipInitialStates, world);

  const mainShip = getShipById(world, mainShipId);

  return {
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

function validateWorldConfig({ mainShipId, physics }: WorldConfigBase): void {
  if (!mainShipId) {
    throw new Error("World config is missing mainShipId");
  }

  const shipIds = new Set<string>();
  for (const ship of physics.ships) {
    if (!ship.id) throw new Error("Ship physics config is missing id");
    shipIds.add(ship.id);
  }

  if (!shipIds.has(mainShipId)) {
    throw new Error(`Main ship physics config not found: ${mainShipId}`);
  }

  const initialStateIds = new Set<string>();
  for (const state of physics.shipInitialStates) {
    if (!state.id) throw new Error("Ship initial state is missing id");
    initialStateIds.add(state.id);
  }

  for (const shipId of shipIds) {
    if (!initialStateIds.has(shipId)) {
      throw new Error(`Ship initial state not found: ${shipId}`);
    }
  }
}
