import type { GamePlugin, RuntimeOptions } from "./pluginPorts";

export type PluginFactory<Context> = (
  runtimeOptions: RuntimeOptions,
  context: Context,
) => GamePlugin;

export type PluginCatalog<Context> = Readonly<
  Record<string, PluginFactory<Context>>
>;

export function loadPlugins<Context>({
  catalog,
  context,
  ids,
  runtimeOptions = {},
}: {
  catalog: PluginCatalog<Context>;
  context: Context;
  ids: readonly string[];
  runtimeOptions?: RuntimeOptions;
}): GamePlugin[] {
  const plugins: GamePlugin[] = [];
  for (const id of ids) {
    const factory = catalog[id];
    if (!factory) continue;
    plugins.push(factory(runtimeOptions, context));
  }
  return plugins;
}
