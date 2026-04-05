import type { GamePlugin } from "../app/pluginPorts";
import { createAutopilotPlugin } from "./autopilot/index";

export type PluginFactory = () => GamePlugin;

export const availablePlugins: Record<string, PluginFactory> = {
  autopilot: createAutopilotPlugin,
};

export function loadPlugins(ids: string[]): GamePlugin[] {
  const plugins: GamePlugin[] = [];
  for (const id of ids) {
    const factory = availablePlugins[id];
    if (!factory) continue;
    plugins.push(factory());
  }
  return plugins;
}
