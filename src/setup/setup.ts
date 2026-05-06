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
  KeplerianBodyPhysicsConfig,
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
  createKeplerianBodiesFromConfig,
  type KeplerianBodiesSetup,
} from "./setupKeplerianBodies";

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
  const entities = config.entities;
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
  const keplerianBodies = entityDerivedSetup.keplerianBodies;
  const controllableBodies = entityDerivedSetup.controllableBodies;
  populateGenericWorldFromSetup(
    world,
    entities,
    controllableBodies,
    keplerianBodies,
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
  keplerianBodies: KeplerianBodiesSetup;
  controllableBodies: ControllableBodiesSetup;
} {
  const keplerianConfigs: KeplerianBodyPhysicsConfig[] = [];
  const controlledBodyConfigs: ControlledBodyPhysicsConfig[] = [];
  const controlledBodyInitialStates: ControlledBodyInitialStateConfig[] = [];

  for (const entity of entities) {
    if (isKeplerianBodyEntityConfig(entity)) {
      keplerianConfigs.push(createKeplerianBodyPhysicsConfig(entity));
    } else if (isControllableEntityConfig(entity)) {
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
    keplerianBodies: createKeplerianBodiesFromConfig(keplerianConfigs),
  };
}

function isKeplerianBodyEntityConfig(entity: EntityConfig): boolean {
  return (
    !!entity.components.axialSpin &&
    !!entity.components.collisionSphere &&
    entity.components.gravityMass?.physicalRadius !== undefined &&
    entity.components.state?.kind === "keplerian"
  );
}

function isControllableEntityConfig(entity: EntityConfig): boolean {
  return !!entity.components.controllable;
}

function createKeplerianBodyPhysicsConfig(
  entity: EntityConfig,
): KeplerianBodyPhysicsConfig {
  const state = requireKeplerianState(entity);
  const mass = requireGravityMass(entity);
  const spin = requireAxialSpin(entity);
  const light = entity.components.lightEmitter;
  return {
    angularSpeedRadPerSec: spin.angularSpeedRadPerSec,
    centralEntityId: state.centralEntityId,
    density: mass.density,
    id: entity.id,
    luminosity: light?.luminosity,
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
    throw new Error(`Keplerian entity is missing radius: ${entity.id}`);
  }
  return physicalRadius;
}

function requireAxialSpin(entity: EntityConfig) {
  const spin = entity.components.axialSpin;
  if (!spin) throw new Error(`Keplerian entity is missing spin: ${entity.id}`);
  return spin;
}

function requireKeplerianState(
  entity: EntityConfig,
): KeplerianEntityStateConfig {
  const state = entity.components.state;
  if (!state || state.kind !== "keplerian") {
    throw new Error(
      `Keplerian entity is missing Keplerian state: ${entity.id}`,
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
  keplerianBodies: KeplerianBodiesSetup,
): void {
  for (const entityConfig of entityConfigs) {
    addGenericEntityById(
      world,
      entityConfig,
      controllableBodies,
      keplerianBodies,
    );
  }
}

function addGenericEntityById(
  world: World,
  entityConfig: EntityConfig,
  controllableBodies: ControllableBodiesSetup,
  keplerianBodies: KeplerianBodiesSetup,
): void {
  const id = entityConfig.id;
  const controlledBodyIndex = controllableBodies.controllableBodies.findIndex(
    (body) => body.id === id,
  );
  if (controlledBodyIndex >= 0) {
    addControlledBodyEntity(world, controllableBodies, controlledBodyIndex);
    return;
  }

  const bodyIndex = keplerianBodies.bodies.findIndex((body) => body.id === id);
  if (bodyIndex >= 0) {
    addKeplerianBodyEntity(world, keplerianBodies, bodyIndex);
    return;
  }

  throw new Error(`Entity config has no setup output: ${id}`);
}

function addControlledBodyEntity(
  world: World,
  setup: ControllableBodiesSetup,
  index: number,
): void {
  const controlledBody = setup.controllableBodies[index];
  addEntityRecord(world, controlledBody);
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

function addKeplerianBodyEntity(
  world: World,
  setup: KeplerianBodiesSetup,
  index: number,
): void {
  const body = setup.bodies[index];
  addEntityRecord(world, body);
  world.entityStates.push(body);
  world.axialSpins.push({
    angularSpeedRadPerSec: body.angularSpeedRadPerSec,
    id: body.id,
    rotationAxis: body.rotationAxis,
    state: body,
  });
  const physics = setup.physics[index];
  if (physics) {
    world.gravityMasses.push({
      density: physics.density,
      id: body.id,
      mass: physics.mass,
      state: body,
    });
    world.collisionSpheres.push({
      id: body.id,
      radius: physics.physicalRadius,
      state: body,
    });
  }
  const luminosity = setup.lightEmitterLuminosities[index];
  if (luminosity !== undefined) {
    world.lightEmitters.push({
      id: body.id,
      luminosity,
      state: body,
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
