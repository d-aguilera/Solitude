import type { WorldAndSceneConfig } from "./configPorts";
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
    addCelestialBodies: (contribution: CelestialBodyContribution) => {
      config.physics.planets.push(...contribution.physics);
      config.render.planets.push(...contribution.render);
    },
    addShips: (contribution: ShipContribution) => {
      config.physics.ships.push(...contribution.physics);
      config.physics.shipInitialStates.push(...contribution.initialStates);
      config.render.ships.push(...contribution.render);
    },
    setMainShipId: (id: string) => {
      config.mainShipId = id;
    },
  };

  for (const plugin of worldModelPlugins) {
    plugin.contributeWorldModel(registry, { config });
  }
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
