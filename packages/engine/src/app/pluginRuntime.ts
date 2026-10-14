import { collectPluginCapabilityProviders } from "./pluginCapabilities";
import type {
  ControlPlugin,
  GamePlugin,
  PluginAssemblyContributor,
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
    createSimulationPlugins: (capabilityRegistry) => {
      const simulationPlugins: SimulationPlugin[] = [];
      const validators = plugins.filter((plugin) => plugin.validateAssembly);
      const contributors: PluginAssemblyContributor[] = [];
      for (const plugin of plugins) {
        const simulation =
          typeof plugin.simulation === "function"
            ? plugin.simulation({ capabilityRegistry, controlPlugins })
            : plugin.simulation;
        if (simulation) simulationPlugins.push(simulation);
        if (validators.length > 0)
          contributors.push(describeContributor(plugin, simulation));
      }
      simulationPlugins.push(...additionalSimulationPlugins);
      if (validators.length > 0) {
        contributors.push(
          Object.freeze({
            id: "$additional",
            capabilities: Object.freeze([...additionalCapabilityProviders]),
            hooks: Object.freeze([
              ...additionalControlPlugins.flatMap((control) =>
                describeHooks("controls", control),
              ),
              ...additionalSimulationPlugins.flatMap((simulation) =>
                describeHooks("simulation", simulation),
              ),
            ]),
          }),
        );
        const context = Object.freeze({
          contributors: Object.freeze(contributors),
          capabilityRegistry: Object.freeze({
            getAll: capabilityRegistry.getAll,
          }),
        });
        for (const plugin of validators) {
          try {
            plugin.validateAssembly!(context);
          } catch (error) {
            throw Object.assign(
              new Error(
                `Plugin "${plugin.id}" assembly rejected: ${error instanceof Error ? error.message : String(error)}`,
              ),
              { cause: error },
            );
          }
        }
      }
      return simulationPlugins;
    },
  };
}

function describeContributor(
  plugin: GamePlugin,
  simulation: SimulationPlugin | undefined,
): PluginAssemblyContributor {
  return Object.freeze({
    id: plugin.id,
    capabilities: Object.freeze([...(plugin.capabilities ?? [])]),
    hooks: Object.freeze([
      ...describeHooks("loop", plugin.loop),
      ...describeHooks("controls", plugin.controls),
      ...describeHooks("simulation", simulation),
    ]),
  });
}

function describeHooks(
  group: string,
  contribution: object | undefined,
): string[] {
  if (!contribution) return [];
  const keys =
    group === "loop"
      ? ["initLoop", "getInitialSimTimeMillis", "updateLoopState", "afterFrame"]
      : group === "controls"
        ? ["updateControlState", "getAttitudeCommand"]
        : [
            "beforeVehicleDynamics",
            "updateVehicleDynamics",
            "afterVehicleDynamics",
            "beforeGravity",
            "afterGravity",
            "afterCollisions",
            "afterSpin",
          ];
  return keys
    .filter(
      (key) =>
        typeof (contribution as Record<string, unknown>)[key] === "function",
    )
    .map((key) => `${group}.${key}`);
}
