import type {
  PlanetPhysicsConfig,
  PlanetRenderConfig,
  ShipInitialStateConfig,
  ShipPhysicsConfig,
  ShipRenderConfig,
  StarPhysicsConfig,
  StarRenderConfig,
  WorldAndSceneConfig,
} from "./configPorts";
import { buildEntityConfigIndex } from "./entityConfig";
import type {
  DirectEntityStateConfig,
  EntityConfig,
  KeplerianEntityStateConfig,
} from "./entityConfigPorts";
import type {
  CelestialBodyContribution,
  GamePlugin,
  ShipContribution,
  WorldModelPlugin,
  WorldModelRegistry,
} from "./pluginPorts";

export function applyWorldModelPlugins(
  config: WorldAndSceneConfig,
  plugins: GamePlugin[],
): void {
  const worldModelPlugins = collectWorldModelPlugins(plugins);
  const registry: WorldModelRegistry = {
    addEntities: (entities: EntityConfig[]) => {
      config.entities.push(...entities);
      addLegacyConfigFromEntities(config, entities);
    },
    addCelestialBodies: (contribution: CelestialBodyContribution) => {
      config.entities.push(...adaptCelestialBodiesToEntities(contribution));
      config.physics.planets.push(...contribution.physics);
      config.render.planets.push(...contribution.render);
    },
    addShips: (contribution: ShipContribution) => {
      config.entities.push(...adaptShipsToEntities(contribution));
      config.physics.ships.push(...contribution.physics);
      config.physics.shipInitialStates.push(...contribution.initialStates);
      config.render.ships.push(...contribution.render);
    },
    setMainControlledEntityId: (id: string) => {
      config.mainControlledEntityId = id;
    },
    setMainShipId: (id: string) => {
      config.mainShipId = id;
      config.mainControlledEntityId = id;
    },
  };

  for (const plugin of worldModelPlugins) {
    plugin.contributeWorldModel(registry, { config });
  }

  buildEntityConfigIndex(config.entities);
}

function addLegacyConfigFromEntities(
  config: WorldAndSceneConfig,
  entities: EntityConfig[],
): void {
  for (const entity of entities) {
    if (entity.metadata?.legacyKind === "planet") {
      addLegacyPlanetConfig(config, entity);
    } else if (entity.metadata?.legacyKind === "star") {
      addLegacyStarConfig(config, entity);
    } else if (entity.metadata?.legacyKind === "ship") {
      addLegacyShipConfig(config, entity);
    }
  }
}

function addLegacyPlanetConfig(
  config: WorldAndSceneConfig,
  entity: EntityConfig,
): void {
  const state = requireKeplerianState(entity);
  const mass = requireGravityMass(entity);
  const spin = requireAxialSpin(entity);
  const renderable = entity.components.renderable;

  const physics: PlanetPhysicsConfig = {
    angularSpeedRadPerSec: spin.angularSpeedRadPerSec,
    centralBodyId: state.centralBodyId,
    density: mass.density,
    id: entity.id,
    kind: "planet",
    obliquityRad: spin.obliquityRad,
    orbit: state.orbit,
    physicalRadius: requirePhysicalRadius(entity),
  };
  config.physics.planets.push(physics);

  if (renderable) {
    const render: PlanetRenderConfig = {
      centralBodyId: state.centralBodyId,
      color: renderable.color,
      id: entity.id,
      kind: "planet",
      mesh: renderable.mesh,
    };
    config.render.planets.push(render);
  }
}

function addLegacyStarConfig(
  config: WorldAndSceneConfig,
  entity: EntityConfig,
): void {
  const state = requireKeplerianState(entity);
  const mass = requireGravityMass(entity);
  const spin = requireAxialSpin(entity);
  const light = entity.components.lightEmitter;
  const renderable = entity.components.renderable;
  if (!light)
    throw new Error(`Legacy star entity is missing light: ${entity.id}`);

  const physics: StarPhysicsConfig = {
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
  config.physics.planets.push(physics);

  if (renderable) {
    const render: StarRenderConfig = {
      centralBodyId: state.centralBodyId,
      color: renderable.color,
      id: entity.id,
      kind: "star",
      mesh: renderable.mesh,
    };
    config.render.planets.push(render);
  }
}

function addLegacyShipConfig(
  config: WorldAndSceneConfig,
  entity: EntityConfig,
): void {
  const state = requireDirectState(entity);
  const mass = requireGravityMass(entity);
  const renderable = entity.components.renderable;
  if (!state.frame) {
    throw new Error(`Legacy ship entity is missing frame: ${entity.id}`);
  }
  if (!state.angularVelocity) {
    throw new Error(
      `Legacy ship entity is missing angular velocity: ${entity.id}`,
    );
  }
  if (mass.volume === undefined) {
    throw new Error(`Legacy ship entity is missing volume: ${entity.id}`);
  }

  const physics: ShipPhysicsConfig = {
    density: mass.density,
    id: entity.id,
    volume: mass.volume,
  };
  const initialState: ShipInitialStateConfig = {
    angularVelocity: state.angularVelocity,
    frame: state.frame,
    id: entity.id,
    orientation: state.orientation,
    position: state.position,
    velocity: state.velocity,
  };
  config.physics.ships.push(physics);
  config.physics.shipInitialStates.push(initialState);

  if (renderable) {
    const render: ShipRenderConfig = {
      color: renderable.color,
      id: entity.id,
      mesh: renderable.mesh,
    };
    config.render.ships.push(render);
  }
}

function requireGravityMass(entity: EntityConfig) {
  const mass = entity.components.gravityMass;
  if (!mass)
    throw new Error(`Legacy entity is missing gravity mass: ${entity.id}`);
  return mass;
}

function requirePhysicalRadius(entity: EntityConfig): number {
  const physicalRadius = requireGravityMass(entity).physicalRadius;
  if (physicalRadius === undefined) {
    throw new Error(`Legacy celestial entity is missing radius: ${entity.id}`);
  }
  return physicalRadius;
}

function requireAxialSpin(entity: EntityConfig) {
  const spin = entity.components.axialSpin;
  if (!spin)
    throw new Error(`Legacy celestial entity is missing spin: ${entity.id}`);
  return spin;
}

function requireKeplerianState(
  entity: EntityConfig,
): KeplerianEntityStateConfig {
  const state = entity.components.state;
  if (!state || state.kind !== "keplerian") {
    throw new Error(
      `Legacy celestial entity is missing Keplerian state: ${entity.id}`,
    );
  }
  return state;
}

function requireDirectState(entity: EntityConfig): DirectEntityStateConfig {
  const state = entity.components.state;
  if (!state || state.kind !== "direct") {
    throw new Error(`Legacy ship entity is missing direct state: ${entity.id}`);
  }
  return state;
}

function collectWorldModelPlugins(plugins: GamePlugin[]): WorldModelPlugin[] {
  const worldModelPlugins: WorldModelPlugin[] = [];
  for (const plugin of plugins) {
    if (plugin.worldModel) {
      worldModelPlugins.push(plugin.worldModel);
    }
  }
  return worldModelPlugins;
}

function adaptCelestialBodiesToEntities({
  physics,
  render,
}: CelestialBodyContribution): EntityConfig[] {
  const entities: EntityConfig[] = [];
  for (const body of physics) {
    const renderConfig = render.find((item) => item.id === body.id);
    entities.push({
      id: body.id,
      metadata: {
        legacyKind: body.kind,
      },
      components: {
        axialSpin: {
          angularSpeedRadPerSec: body.angularSpeedRadPerSec,
          obliquityRad: body.obliquityRad,
        },
        collisionSphere: {
          radius: body.physicalRadius,
        },
        gravityMass: {
          density: body.density,
          physicalRadius: body.physicalRadius,
        },
        lightEmitter:
          body.kind === "star"
            ? {
                luminosity: body.luminosity,
              }
            : undefined,
        renderable: renderConfig
          ? {
              color: renderConfig.color,
              mesh: renderConfig.mesh,
            }
          : undefined,
        state: {
          centralBodyId: body.centralBodyId,
          kind: "keplerian",
          orbit: body.orbit,
        },
      },
    });
  }
  return entities;
}

function adaptShipsToEntities({
  initialStates,
  physics,
  render,
}: ShipContribution): EntityConfig[] {
  const entities: EntityConfig[] = [];
  for (const ship of physics) {
    const initialState = initialStates.find((item) => item.id === ship.id);
    const renderConfig = render.find((item) => item.id === ship.id);
    entities.push({
      id: ship.id,
      metadata: {
        legacyKind: "ship",
      },
      components: {
        controllable: {
          enabled: true,
        },
        gravityMass: {
          density: ship.density,
          volume: ship.volume,
        },
        renderable: renderConfig
          ? {
              color: renderConfig.color,
              mesh: renderConfig.mesh,
            }
          : undefined,
        state: initialState
          ? {
              angularVelocity: initialState.angularVelocity,
              frame: initialState.frame,
              kind: "direct",
              orientation: initialState.orientation,
              position: initialState.position,
              velocity: initialState.velocity,
            }
          : undefined,
      },
    });
  }
  return entities;
}
