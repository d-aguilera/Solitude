import type { WorldAndSceneConfig } from "./configPorts";
import { buildEntityConfigIndex } from "./entityConfig";
import type { EntityConfig } from "./entityConfigPorts";
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
