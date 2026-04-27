import type { WorldAndSceneConfig } from "./configPorts";
import { buildEntityConfigIndex } from "./entityConfig";
import type { EntityConfig } from "./entityConfigPorts";
import type {
  GamePlugin,
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
