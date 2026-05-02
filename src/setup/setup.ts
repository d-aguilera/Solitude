import {
  requireMainFocusEntityId,
  type WorldAndSceneConfig,
} from "../app/configPorts";
import { buildEntityConfigIndex } from "../app/entityConfig";
import type {
  DirectEntityStateConfig,
  EntityConfig,
  KeplerianEntityStateConfig,
} from "../app/entityConfigPorts";
import type {
  ControlledBodyInitialStateConfig,
  ControlledBodyPhysicsConfig,
  PlanetPhysicsConfig,
  StarPhysicsConfig,
} from "../app/physicsConfigPorts";
import type { FocusContext } from "../app/runtimePorts";
import type {
  ControlledBody,
  EntityRecord,
  World,
} from "../domain/domainPorts";
import { type LocalFrame, localFrame } from "../domain/localFrame";
import { vec3 } from "../domain/vec3";
import {
  type ControllableBodiesSetup,
  createControllableBodiesFromConfig,
} from "./setupControllableBodies";
import {
  createPlanetsAndStarsFromConfig,
  type PlanetsAndStarsSetup,
} from "./setupPlanets";

export const initialFrame: LocalFrame = localFrame.fromUp(vec3.create(0, 0, 1));

export interface WorldSetup {
  mainFocus: FocusContext;
  world: World;
}

export type WorldConfigBase = Pick<
  WorldAndSceneConfig,
  "entities" | "mainFocusEntityId"
>;

export function createWorld(config: WorldConfigBase): WorldSetup {
  validateWorldConfig(config);
  const { entities } = config;
  const mainFocusEntityId = requireMainFocusEntityId(config);

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

  const entityDerivedSetup = createSetupFromEntityConfigs(entities);
  const planetsAndStars = entityDerivedSetup.planetsAndStars;
  const controllableBodies = entityDerivedSetup.controllableBodies;
  populateGenericWorldFromSetup(
    world,
    entities,
    controllableBodies,
    planetsAndStars,
  );

  const focusedControlledBody = getControlledBodyById(world, mainFocusEntityId);
  const mainFocus: FocusContext = {
    controlledBody: focusedControlledBody,
    entityId: mainFocusEntityId,
  };

  return {
    mainFocus,
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
  entities,
  mainFocusEntityId,
}: WorldConfigBase): void {
  const entityIndex = buildEntityConfigIndex(entities);
  const focusEntityId = requireMainFocusEntityId({ mainFocusEntityId });
  if (!entityIndex.byId.has(focusEntityId)) {
    throw new Error(`Main focus entity config not found: ${focusEntityId}`);
  }
  if (!entityIndex.controllableEntityIds.includes(focusEntityId)) {
    throw new Error(`Main focus entity is not controllable: ${focusEntityId}`);
  }
}

function createSetupFromEntityConfigs(entities: EntityConfig[]): {
  planetsAndStars: PlanetsAndStarsSetup;
  controllableBodies: ControllableBodiesSetup;
} {
  const celestialConfigs: (PlanetPhysicsConfig | StarPhysicsConfig)[] = [];
  const controlledBodyConfigs: ControlledBodyPhysicsConfig[] = [];
  const controlledBodyInitialStates: ControlledBodyInitialStateConfig[] = [];

  for (const entity of entities) {
    if (entity.metadata?.legacyKind === "planet") {
      celestialConfigs.push(createPlanetPhysicsConfig(entity));
    } else if (entity.metadata?.legacyKind === "star") {
      celestialConfigs.push(createStarPhysicsConfig(entity));
    } else if (entity.components.controllable) {
      controlledBodyConfigs.push(createControlledBodyPhysicsConfig(entity));
      controlledBodyInitialStates.push(
        createControlledBodyInitialStateConfig(entity),
      );
    }
  }

  return {
    controllableBodies: createControllableBodiesFromConfig(
      controlledBodyConfigs,
      controlledBodyInitialStates,
    ),
    planetsAndStars: createPlanetsAndStarsFromConfig(celestialConfigs),
  };
}

function createPlanetPhysicsConfig(entity: EntityConfig): PlanetPhysicsConfig {
  const state = requireKeplerianState(entity);
  const mass = requireGravityMass(entity);
  const spin = requireAxialSpin(entity);
  return {
    angularSpeedRadPerSec: spin.angularSpeedRadPerSec,
    centralBodyId: state.centralBodyId,
    density: mass.density,
    id: entity.id,
    kind: "planet",
    obliquityRad: spin.obliquityRad,
    orbit: state.orbit,
    physicalRadius: requirePhysicalRadius(entity),
  };
}

function createStarPhysicsConfig(entity: EntityConfig): StarPhysicsConfig {
  const state = requireKeplerianState(entity);
  const mass = requireGravityMass(entity);
  const spin = requireAxialSpin(entity);
  const light = entity.components.lightEmitter;
  if (!light) throw new Error(`Star entity is missing light: ${entity.id}`);
  return {
    angularSpeedRadPerSec: spin.angularSpeedRadPerSec,
    centralBodyId: state.centralBodyId,
    density: mass.density,
    id: entity.id,
    kind: "star",
    luminosity: light.luminosity,
    obliquityRad: spin.obliquityRad,
    orbit: state.orbit,
    physicalRadius: requirePhysicalRadius(entity),
  };
}

function createControlledBodyPhysicsConfig(
  entity: EntityConfig,
): ControlledBodyPhysicsConfig {
  const mass = requireGravityMass(entity);
  if (mass.volume === undefined) {
    throw new Error(`Controlled entity is missing volume: ${entity.id}`);
  }
  return {
    density: mass.density,
    id: entity.id,
    volume: mass.volume,
  };
}

function createControlledBodyInitialStateConfig(
  entity: EntityConfig,
): ControlledBodyInitialStateConfig {
  const state = requireDirectState(entity);
  if (!state.frame) {
    throw new Error(`Controlled entity is missing frame: ${entity.id}`);
  }
  if (!state.angularVelocity) {
    throw new Error(
      `Controlled entity is missing angular velocity: ${entity.id}`,
    );
  }
  return {
    angularVelocity: state.angularVelocity,
    frame: state.frame,
    id: entity.id,
    orientation: state.orientation,
    position: state.position,
    velocity: state.velocity,
  };
}

function requireGravityMass(entity: EntityConfig) {
  const mass = entity.components.gravityMass;
  if (!mass) throw new Error(`Entity is missing gravity mass: ${entity.id}`);
  return mass;
}

function requirePhysicalRadius(entity: EntityConfig): number {
  const physicalRadius = requireGravityMass(entity).physicalRadius;
  if (physicalRadius === undefined) {
    throw new Error(`Celestial entity is missing radius: ${entity.id}`);
  }
  return physicalRadius;
}

function requireAxialSpin(entity: EntityConfig) {
  const spin = entity.components.axialSpin;
  if (!spin) throw new Error(`Celestial entity is missing spin: ${entity.id}`);
  return spin;
}

function requireKeplerianState(
  entity: EntityConfig,
): KeplerianEntityStateConfig {
  const state = entity.components.state;
  if (!state || state.kind !== "keplerian") {
    throw new Error(
      `Celestial entity is missing Keplerian state: ${entity.id}`,
    );
  }
  return state;
}

function requireDirectState(entity: EntityConfig): DirectEntityStateConfig {
  const state = entity.components.state;
  if (!state || state.kind !== "direct") {
    throw new Error(`Controlled entity is missing direct state: ${entity.id}`);
  }
  return state;
}

function populateGenericWorldFromSetup(
  world: World,
  entityConfigs: EntityConfig[],
  controllableBodies: ControllableBodiesSetup,
  planetsAndStars: PlanetsAndStarsSetup,
): void {
  for (const entityConfig of entityConfigs) {
    addGenericEntityById(
      world,
      entityConfig,
      controllableBodies,
      planetsAndStars,
    );
  }
}

function addGenericEntityById(
  world: World,
  entityConfig: EntityConfig,
  controllableBodies: ControllableBodiesSetup,
  planetsAndStars: PlanetsAndStarsSetup,
): void {
  const id = entityConfig.id;
  const controlledBodyIndex = controllableBodies.controllableBodies.findIndex(
    (body) => body.id === id,
  );
  if (controlledBodyIndex >= 0) {
    addControlledBodyEntity(
      world,
      controllableBodies,
      controlledBodyIndex,
      entityConfig.metadata?.legacyKind,
    );
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

function addControlledBodyEntity(
  world: World,
  setup: ControllableBodiesSetup,
  index: number,
  legacyKind: EntityRecord["legacyKind"] = "ship",
): void {
  const controlledBody = setup.controllableBodies[index];
  addEntityRecord(world, controlledBody, legacyKind);
  world.entityStates.push(controlledBody);
  world.controllableBodies.push(controlledBody);
  const physics = setup.controlledBodyPhysics[index];
  if (physics) {
    world.gravityMasses.push({
      density: physics.density,
      id: controlledBody.id,
      mass: physics.mass,
      state: controlledBody,
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
