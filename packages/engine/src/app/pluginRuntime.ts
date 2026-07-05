import { collectPluginCapabilityProviders } from "./pluginCapabilities";
import type {
  ControlPlugin,
  GamePlugin,
  PluginCapabilityProvider,
  PluginCapabilityRegistry,
  SimulationPlugin,
} from "./pluginPorts";

export interface SimulationPluginAssembly {
  capabilityProviders: PluginCapabilityProvider[];
  createSimulationPlugins: (
    capabilityRegistry: PluginCapabilityRegistry,
  ) => SimulationPlugin[];
}

export function assembleSimulationPlugins(
  plugins: readonly GamePlugin[],
  additionalCapabilityProviders: readonly PluginCapabilityProvider[],
  additionalControlPlugins: readonly ControlPlugin[],
  additionalSimulationPlugins: readonly SimulationPlugin[],
): SimulationPluginAssembly {
  const capabilityProviders = collectPluginCapabilityProviders(plugins).concat(
    additionalCapabilityProviders,
  );
  const controlPlugins = plugins
    .flatMap((plugin) => (plugin.controls ? [plugin.controls] : []))
    .concat(additionalControlPlugins);

  return {
    capabilityProviders,
    createSimulationPlugins: (capabilityRegistry) =>
      plugins
        .flatMap((plugin) => {
          if (!plugin.simulation) return [];
          return [
            typeof plugin.simulation === "function"
              ? plugin.simulation({ capabilityRegistry, controlPlugins })
              : plugin.simulation,
          ];
        })
        .concat(additionalSimulationPlugins),
  };
}
