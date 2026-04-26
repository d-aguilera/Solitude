import type { WorldAndSceneConfig } from "../app/configPorts";
import { buildEntityConfigIndex } from "../app/entityConfig";
import type { EntityConfig } from "../app/entityConfigPorts";
import { getShipById } from "../app/worldLookup";
import type {
  ControlledBody,
  EntityRecord,
  ShipBody,
  World,
} from "../domain/domainPorts";
import { type LocalFrame, localFrame } from "../domain/localFrame";
import { vec3 } from "../domain/vec3";
import { addPlanetsAndStarsFromConfig } from "./setupPlanets";
import { addShipsFromConfig } from "./setupShips";

export const initialFrame: LocalFrame = localFrame.fromUp(vec3.create(0, 0, 1));

export interface WorldSetup {
  mainControlledBody: ControlledBody;
  mainShip: ShipBody;
  world: World;
}

export type WorldConfigBase = Pick<
  WorldAndSceneConfig,
  "mainShipId" | "physics"
> &
  Partial<Pick<WorldAndSceneConfig, "entities" | "mainControlledEntityId">>;

export function createWorld({
  entities = [],
  mainControlledEntityId,
  mainShipId,
  physics,
}: WorldConfigBase): WorldSetup {
  const resolvedMainControlledEntityId = mainControlledEntityId || mainShipId;
  validateWorldConfig({
    entities,
    mainControlledEntityId: resolvedMainControlledEntityId,
    mainShipId,
    physics,
  });

  const world: World = {
    axialSpins: [],
    collisionSpheres: [],
    controllableBodies: [],
    entities: [],
    entityIndex: new Map(),
    entityStates: [],
    gravityMasses: [],
    lightEmitters: [],
    ships: [],
    shipPhysics: [],
    planets: [],
    planetPhysics: [],
    stars: [],
    starPhysics: [],
  };

  addPlanetsAndStarsFromConfig(physics.planets, world);
  addShipsFromConfig(physics.ships, physics.shipInitialStates, world);
  populateGenericWorldFromLegacy(world, entities);

  const mainShip = getShipById(world, mainShipId);
  const mainControlledBody = getControlledBodyById(
    world,
    resolvedMainControlledEntityId,
  );

  return {
    mainControlledBody,
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

function validateWorldConfig({
  entities = [],
  mainControlledEntityId,
  mainShipId,
  physics,
}: WorldConfigBase & { mainControlledEntityId: string }): void {
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

  if (entities.length > 0) {
    const entityIndex = buildEntityConfigIndex(entities);
    if (!mainControlledEntityId) {
      throw new Error("World config is missing mainControlledEntityId");
    }
    if (!entityIndex.byId.has(mainControlledEntityId)) {
      throw new Error(
        `Main controlled entity config not found: ${mainControlledEntityId}`,
      );
    }
    if (!entityIndex.controllableEntityIds.includes(mainControlledEntityId)) {
      throw new Error(
        `Main controlled entity is not controllable: ${mainControlledEntityId}`,
      );
    }
  }
}

function populateGenericWorldFromLegacy(
  world: World,
  entityConfigs: EntityConfig[],
): void {
  if (entityConfigs.length > 0) {
    for (const entityConfig of entityConfigs) {
      addGenericEntityById(world, entityConfig.id);
    }
    return;
  }

  for (let i = 0; i < world.ships.length; i++) {
    addShipEntity(world, i);
  }

  for (let i = 0; i < world.planets.length; i++) {
    addPlanetEntity(world, i);
  }

  for (let i = 0; i < world.stars.length; i++) {
    addStarEntity(world, i);
  }
}

function addGenericEntityById(world: World, id: string): void {
  const shipIndex = world.ships.findIndex((ship) => ship.id === id);
  if (shipIndex >= 0) {
    addShipEntity(world, shipIndex);
    return;
  }

  const planetIndex = world.planets.findIndex((planet) => planet.id === id);
  if (planetIndex >= 0) {
    addPlanetEntity(world, planetIndex);
    return;
  }

  const starIndex = world.stars.findIndex((star) => star.id === id);
  if (starIndex >= 0) {
    addStarEntity(world, starIndex);
    return;
  }

  throw new Error(`Entity config has no setup output: ${id}`);
}

function addShipEntity(world: World, index: number): void {
  const ship = world.ships[index];
  addEntityRecord(world, ship);
  world.entityStates.push(ship);
  world.controllableBodies.push(ship);
  const physics = world.shipPhysics[index];
  if (physics) {
    world.gravityMasses.push({
      density: physics.density,
      id: ship.id,
      mass: physics.mass,
    });
  }
}

function addPlanetEntity(world: World, index: number): void {
  const planet = world.planets[index];
  addEntityRecord(world, planet);
  world.entityStates.push(planet);
  world.axialSpins.push({
    angularSpeedRadPerSec: planet.angularSpeedRadPerSec,
    id: planet.id,
    rotationAxis: planet.rotationAxis,
  });
  const physics = world.planetPhysics[index];
  if (physics) {
    world.gravityMasses.push({
      density: physics.density,
      id: planet.id,
      mass: physics.mass,
    });
    world.collisionSpheres.push({
      id: planet.id,
      radius: physics.physicalRadius,
    });
  }
}

function addStarEntity(world: World, index: number): void {
  const star = world.stars[index];
  addEntityRecord(world, star);
  world.entityStates.push(star);
  world.axialSpins.push({
    angularSpeedRadPerSec: star.angularSpeedRadPerSec,
    id: star.id,
    rotationAxis: star.rotationAxis,
  });
  const physics = world.starPhysics[index];
  if (physics) {
    world.gravityMasses.push({
      density: physics.density,
      id: star.id,
      mass: physics.mass,
    });
    world.collisionSpheres.push({
      id: star.id,
      radius: physics.physicalRadius,
    });
    world.lightEmitters.push({
      id: star.id,
      luminosity: physics.luminosity,
    });
  }
}

function addEntityRecord(world: World, entity: EntityRecord): void {
  const record: EntityRecord = { id: entity.id };
  world.entities.push(record);
  world.entityIndex.set(record.id, record);
}

function getControlledBodyById(world: World, id: string): ControlledBody {
  const body = world.controllableBodies.find((item) => item.id === id);
  if (!body) throw new Error(`Controlled entity not found: ${id}`);
  return body;
}
