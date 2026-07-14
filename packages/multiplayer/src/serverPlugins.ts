import { loadServerPlugin } from "@solitude/plugin-runtime/server";
import { resolve } from "node:path";
import type { DefaultMultiplayerContentPluginFactories } from "./composition";

const serverPluginRootEnvironmentVariable = "SOLITUDE_SERVER_PLUGIN_ROOT";
const defaultServerPluginRoot = "dist/plugin-packages/core-pack-v1";

export async function loadDefaultMultiplayerContentPluginFactories(
  env: Readonly<Record<string, string | undefined>>,
): Promise<DefaultMultiplayerContentPluginFactories> {
  const pluginRoot = resolve(
    env[serverPluginRootEnvironmentVariable] ?? defaultServerPluginRoot,
  );
  const loaded = await loadServerPlugin(
    resolve(pluginRoot, "poly-fighter/plugin.json"),
  );
  const polyFighter = loaded.catalog.polyFighter;
  if (
    !polyFighter ||
    loaded.ids.length !== 1 ||
    loaded.ids[0] !== "polyFighter"
  ) {
    throw new Error(
      "Poly fighter server plugin manifest returned an invalid set",
    );
  }
  return { polyFighter };
}
