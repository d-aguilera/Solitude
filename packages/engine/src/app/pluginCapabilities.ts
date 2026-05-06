import type {
  PluginCapabilityProvider,
  PluginCapabilityRegistry,
} from "./pluginPorts";

const emptyCapabilities: readonly unknown[] = [];

export function createPluginCapabilityRegistry(
  providers: readonly PluginCapabilityProvider[] = [],
): PluginCapabilityRegistry {
  const byId = new Map<string, unknown[]>();

  for (const provider of providers) {
    let values = byId.get(provider.id);
    if (!values) {
      values = [];
      byId.set(provider.id, values);
    }
    values.push(provider.value);
  }

  return {
    getAll: (id) => byId.get(id) ?? emptyCapabilities,
  };
}
