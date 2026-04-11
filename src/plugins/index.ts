import type { GamePlugin } from "../app/pluginPorts";
import { createAutopilotPlugin } from "./autopilot/index";
import { createPausePlugin } from "./pause/index";
import { createProfilingPlugin } from "./profiling/index";
import { createTimeScalePlugin } from "./timeScale/index";
import { createTrajectoriesPlugin } from "./trajectories/index";

export type PluginFactory = () => GamePlugin;

export const availablePlugins: Record<string, PluginFactory> = {
  autopilot: createAutopilotPlugin,
  pause: createPausePlugin,
  profiling: createProfilingPlugin,
  timeScale: createTimeScalePlugin,
  trajectories: createTrajectoriesPlugin,
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
