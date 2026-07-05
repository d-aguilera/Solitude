import type { WorldAndSceneConfig } from "./configPorts";
import { buildEntityConfigIndex } from "./entityConfig";
import type { EntityConfig } from "./entityConfigPorts";
import { createPluginCapabilityRegistry } from "./pluginCapabilities";
import type {
  GamePlugin,
  WorldModelPlugin,
  WorldModelRegistry,
} from "./pluginPorts";

export function applyWorldModelPlugins(
  config: WorldAndSceneConfig,
  plugins: GamePlugin[],
): void {
  const capabilityRegistry = createPluginCapabilityRegistry(plugins);
  const worldModelPlugins = collectWorldModelPlugins(plugins);
  const registry: WorldModelRegistry = {
    addEntities: (entities: EntityConfig[]) => {
      config.entities.push(...entities);
    },
    setMainFocusEntityId: (id: string) => {
      config.mainFocusEntityId = id;
    },
  };

  for (const plugin of worldModelPlugins) {
    plugin.contributeWorldModel(registry, { capabilityRegistry, config });
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
