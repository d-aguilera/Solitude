import type { WorldAndSceneConfig } from "../app/configPorts";
import { buildEntityConfigIndex } from "../app/entityConfig";
import type { EntityConfig } from "../app/entityConfigPorts";
import type {
  ControlledBody,
  EntityRecord,
  ShipBody,
  World,
} from "../domain/domainPorts";
import { type LocalFrame, localFrame } from "../domain/localFrame";
import { vec3 } from "../domain/vec3";
import {
  createPlanetsAndStarsFromConfig,
  type PlanetsAndStarsSetup,
} from "./setupPlanets";
import { createShipsFromConfig, type ShipsSetup } from "./setupShips";

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
  };

  const planetsAndStars = createPlanetsAndStarsFromConfig(physics.planets);
  const ships = createShipsFromConfig(physics.ships, physics.shipInitialStates);
  populateGenericWorldFromSetup(world, entities, ships, planetsAndStars);

  const mainControlledBody = getControlledBodyById(
    world,
    resolvedMainControlledEntityId,
  );
  const mainShip = mainControlledBody;

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

function populateGenericWorldFromSetup(
  world: World,
  entityConfigs: EntityConfig[],
  ships: ShipsSetup,
  planetsAndStars: PlanetsAndStarsSetup,
): void {
  if (entityConfigs.length > 0) {
    for (const entityConfig of entityConfigs) {
      addGenericEntityById(world, entityConfig, ships, planetsAndStars);
    }
    return;
  }

  for (let i = 0; i < ships.ships.length; i++) {
    addShipEntity(world, ships, i);
  }

  for (let i = 0; i < planetsAndStars.planets.length; i++) {
    addPlanetEntity(world, planetsAndStars, i);
  }

  for (let i = 0; i < planetsAndStars.stars.length; i++) {
    addStarEntity(world, planetsAndStars, i);
  }
}

function addGenericEntityById(
  world: World,
  entityConfig: EntityConfig,
  ships: ShipsSetup,
  planetsAndStars: PlanetsAndStarsSetup,
): void {
  const id = entityConfig.id;
  const shipIndex = ships.ships.findIndex((ship) => ship.id === id);
  if (shipIndex >= 0) {
    addShipEntity(world, ships, shipIndex, entityConfig.metadata?.legacyKind);
    return;
  }

  const planetIndex = planetsAndStars.planets.findIndex(
    (planet) => planet.id === id,
  );
  if (planetIndex >= 0) {
    addPlanetEntity(
      world,
      planetsAndStars,
      planetIndex,
      entityConfig.metadata?.legacyKind,
    );
    return;
  }

  const starIndex = planetsAndStars.stars.findIndex((star) => star.id === id);
  if (starIndex >= 0) {
    addStarEntity(
      world,
      planetsAndStars,
      starIndex,
      entityConfig.metadata?.legacyKind,
    );
    return;
  }

  throw new Error(`Entity config has no setup output: ${id}`);
}

function addShipEntity(
  world: World,
  setup: ShipsSetup,
  index: number,
  legacyKind: EntityRecord["legacyKind"] = "ship",
): void {
  const ship = setup.ships[index];
  addEntityRecord(world, ship, legacyKind);
  world.entityStates.push(ship);
  world.controllableBodies.push(ship);
  const physics = setup.shipPhysics[index];
  if (physics) {
    world.gravityMasses.push({
      density: physics.density,
      id: ship.id,
      mass: physics.mass,
      state: ship,
    });
  }
}

function addPlanetEntity(
  world: World,
  setup: PlanetsAndStarsSetup,
  index: number,
  legacyKind: EntityRecord["legacyKind"] = "planet",
): void {
  const planet = setup.planets[index];
  addEntityRecord(world, planet, legacyKind);
  world.entityStates.push(planet);
  world.axialSpins.push({
    angularSpeedRadPerSec: planet.angularSpeedRadPerSec,
    id: planet.id,
    rotationAxis: planet.rotationAxis,
    state: planet,
  });
  const physics = setup.planetPhysics[index];
  if (physics) {
    world.gravityMasses.push({
      density: physics.density,
      id: planet.id,
      mass: physics.mass,
      state: planet,
    });
    world.collisionSpheres.push({
      id: planet.id,
      radius: physics.physicalRadius,
      state: planet,
    });
  }
}

function addStarEntity(
  world: World,
  setup: PlanetsAndStarsSetup,
  index: number,
  legacyKind: EntityRecord["legacyKind"] = "star",
): void {
  const star = setup.stars[index];
  addEntityRecord(world, star, legacyKind);
  world.entityStates.push(star);
  world.axialSpins.push({
    angularSpeedRadPerSec: star.angularSpeedRadPerSec,
    id: star.id,
    rotationAxis: star.rotationAxis,
    state: star,
  });
  const physics = setup.starPhysics[index];
  if (physics) {
    world.gravityMasses.push({
      density: physics.density,
      id: star.id,
      mass: physics.mass,
      state: star,
    });
    world.collisionSpheres.push({
      id: star.id,
      radius: physics.physicalRadius,
      state: star,
    });
    world.lightEmitters.push({
      id: star.id,
      luminosity: physics.luminosity,
      state: star,
    });
  }
}

function addEntityRecord(
  world: World,
  entity: EntityRecord,
  legacyKind?: EntityRecord["legacyKind"],
): void {
  const record: EntityRecord = { id: entity.id, legacyKind };
  world.entities.push(record);
  world.entityIndex.set(record.id, record);
}

function getControlledBodyById(world: World, id: string): ControlledBody {
  const body = world.controllableBodies.find((item) => item.id === id);
  if (!body) throw new Error(`Controlled entity not found: ${id}`);
  return body;
}
