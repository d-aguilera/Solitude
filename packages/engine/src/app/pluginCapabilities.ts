import type {
  GamePlugin,
  PluginCapabilityProvider,
  PluginCapabilityRegistry,
} from "./pluginPorts";

const emptyCapabilities: readonly unknown[] = [];

export function collectPluginCapabilityProviders(
  plugins: readonly GamePlugin[],
): PluginCapabilityProvider[] {
  return plugins.flatMap((plugin) => plugin.capabilities ?? []);
}

export function createPluginCapabilityRegistry(
  from: readonly GamePlugin[] | readonly PluginCapabilityProvider[] = [],
): PluginCapabilityRegistry {
  const byId = new Map<string, unknown[]>();

  for (const provider of normalizeCapabilityProviders(from)) {
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

function normalizeCapabilityProviders(
  from: readonly GamePlugin[] | readonly PluginCapabilityProvider[],
): readonly PluginCapabilityProvider[] {
  if (from.length === 0) return [];
  return isCapabilityProvider(from[0])
    ? (from as readonly PluginCapabilityProvider[])
    : collectPluginCapabilityProviders(from as readonly GamePlugin[]);
}

function isCapabilityProvider(
  item: GamePlugin | PluginCapabilityProvider,
): item is PluginCapabilityProvider {
  return "value" in item;
}
