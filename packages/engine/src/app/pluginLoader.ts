import type { GamePlugin, RuntimeOptions } from "./pluginPorts";

export type PluginFactory = (runtimeOptions: RuntimeOptions) => GamePlugin;

export type PluginCatalog = Readonly<Record<string, PluginFactory>>;

export function loadPlugins({
  catalog,
  ids,
  runtimeOptions = {},
}: {
  catalog: PluginCatalog;
  ids: readonly string[];
  runtimeOptions?: RuntimeOptions;
}): GamePlugin[] {
  const plugins: GamePlugin[] = [];
  for (const id of ids) {
    const factory = catalog[id];
    if (!factory) continue;
    plugins.push(factory(runtimeOptions));
  }
  return plugins;
}
