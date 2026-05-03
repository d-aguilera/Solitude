import type { GamePlugin, RuntimeOptions } from "../app/pluginPorts";
import { createAutopilotPlugin } from "./autopilot/index";
import { createAxialViewsPlugin } from "./axialViews/index";
import { createMemoryPlugin } from "./memory/index";
import { createOrbitTelemetryPlugin } from "./orbitTelemetry/index";
import { createPausePlugin } from "./pause/index";
import { createPlaybackPlugin } from "./playback/index";
import {
  createPluginCompositionContext,
  type PluginCompositionContext,
} from "./pluginComposition";
import { createProfilingPlugin } from "./profiling/index";
import { createRuntimeTelemetryPlugin } from "./runtimeTelemetry/index";
import { createShipTelemetryPlugin } from "./shipTelemetry/index";
import { createSolarSystemPlugin } from "./solarSystem/index";
import { createSpacecraftOperatorPlugin } from "./spacecraftOperator/index";
import { createTimeScalePlugin } from "./timeScale/index";
import { createTrajectoriesPlugin } from "./trajectories/index";
import { createVelocitySegmentsPlugin } from "./velocitySegments/index";

export type PluginFactory = (
  runtimeOptions: RuntimeOptions,
  context: PluginCompositionContext,
) => GamePlugin;

export const defaultPluginIds = [
  "solarSystem",
  "spacecraftOperator",
  "axialViews",
  "orbitTelemetry",
  "runtimeTelemetry",
  "shipTelemetry",
  "autopilot",
  "memory",
  "pause",
  "profiling",
  "timeScale",
  "playback",
  "trajectories",
  "velocitySegments",
];

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
  solarSystem: createSolarSystemPlugin,
  spacecraftOperator: createSpacecraftOperatorPlugin,
  timeScale: createTimeScalePlugin,
  trajectories: createTrajectoriesPlugin,
  velocitySegments: createVelocitySegmentsPlugin,
};

export function loadPlugins(
  ids: string[],
  runtimeOptions: RuntimeOptions = {},
): GamePlugin[] {
  const plugins: GamePlugin[] = [];
  const context = createPluginCompositionContext();
  for (const id of ids) {
    const factory = availablePlugins[id];
    if (!factory) continue;
    plugins.push(factory(runtimeOptions, context));
  }
  return plugins;
}
