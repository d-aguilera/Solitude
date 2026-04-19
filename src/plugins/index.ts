import type { GamePlugin } from "../app/pluginPorts";
import type { RuntimeOptions } from "../app/runtimeOptions";
import { createAutopilotPlugin } from "./autopilot/index";
import { createAxialViewsPlugin } from "./axialViews/index";
import { createMemoryPlugin } from "./memory/index";
import { createOrbitTelemetryPlugin } from "./orbitTelemetry/index";
import { createPausePlugin } from "./pause/index";
import { createPlaybackPlugin } from "./playback/index";
import { createProfilingPlugin } from "./profiling/index";
import { createRuntimeTelemetryPlugin } from "./runtimeTelemetry/index";
import { createShipTelemetryPlugin } from "./shipTelemetry/index";
import { createTimeScalePlugin } from "./timeScale/index";
import { createTrajectoriesPlugin } from "./trajectories/index";
import { createVelocitySegmentsPlugin } from "./velocitySegments/index";

export type PluginFactory = (runtimeOptions: RuntimeOptions) => GamePlugin;

export const availablePlugins: Record<string, PluginFactory> = {
  autopilot: createAutopilotPlugin,
  axialViews: createAxialViewsPlugin,
  memory: createMemoryPlugin,
  orbitTelemetry: createOrbitTelemetryPlugin,
  pause: createPausePlugin,
  playback: createPlaybackPlugin,
  profiling: createProfilingPlugin,
  runtimeTelemetry: createRuntimeTelemetryPlugin,
  shipTelemetry: createShipTelemetryPlugin,
  timeScale: createTimeScalePlugin,
  trajectories: createTrajectoriesPlugin,
  velocitySegments: createVelocitySegmentsPlugin,
};

export function loadPlugins(
  ids: string[],
  runtimeOptions: RuntimeOptions = {},
): GamePlugin[] {
  const plugins: GamePlugin[] = [];
  for (const id of ids) {
    const factory = availablePlugins[id];
    if (!factory) continue;
    plugins.push(factory(runtimeOptions));
  }
  return plugins;
}
