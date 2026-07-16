import { loadServerPluginSet } from "@solitude/plugin-runtime/server";
import { resolve } from "node:path";
import type { DefaultMultiplayerContentPluginSet } from "./composition";

const serverPluginSetEnvironmentVariable = "SOLITUDE_SERVER_PLUGIN_SET";
const defaultServerPluginSet = "dist/server/plugins/plugin-set.json";

export async function loadDefaultMultiplayerContentPluginSet(
  env: Readonly<Record<string, string | undefined>>,
): Promise<DefaultMultiplayerContentPluginSet> {
  return loadServerPluginSet(
    resolve(env[serverPluginSetEnvironmentVariable] ?? defaultServerPluginSet),
  );
}
