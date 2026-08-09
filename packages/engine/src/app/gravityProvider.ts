import type { GravityEngine } from "../domain/domainPorts";
import type { GamePlugin } from "./pluginPorts";

export function resolveGravityEngine(
  plugins: readonly GamePlugin[],
): GravityEngine {
  let providerPlugin: GamePlugin | undefined;

  for (const plugin of plugins) {
    if (plugin.gravity === undefined) continue;
    if (providerPlugin !== undefined) {
      throw new Error(
        `Multiple gravity providers: "${providerPlugin.id}" and "${plugin.id}"`,
      );
    }
    providerPlugin = plugin;
  }

  if (providerPlugin?.gravity === undefined) {
    throw new Error("A gravity provider plugin is required");
  }

  const gravityEngine = providerPlugin.gravity.createGravityEngine();
  if (
    gravityEngine === null ||
    typeof gravityEngine !== "object" ||
    typeof gravityEngine.step !== "function"
  ) {
    throw new Error(
      `Gravity provider "${providerPlugin.id}" returned an invalid engine`,
    );
  }
  return gravityEngine;
}
