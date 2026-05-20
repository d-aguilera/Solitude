import type { GamePlugin, RuntimeOptions } from "@solitude/engine/plugin";
import { createAutopilotPlugin } from "./autopilot/index";
import { createAxialViewsPlugin } from "./axialViews/index";
import { createHudPlugin } from "./hud/index";
import { createMemoryPlugin } from "./memory/index";
import { createOperatorSwitchPlugin } from "./operatorSwitch/index";
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

// Plugin order is runtime behavior: later loop/frame-policy plugins can
// override earlier ones, and input handlers are consulted in reverse order.
export const defaultPluginIds = [
  "solarSystem",
  "spacecraftOperator",
  "hud",
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
  "operatorSwitch",
  "trajectories",
  "velocitySegments",
];

export const availablePlugins: Record<string, PluginFactory> = {
  autopilot: createAutopilotPlugin,
  axialViews: createAxialViewsPlugin,
  hud: createHudPlugin,
  memory: createMemoryPlugin,
  orbitTelemetry: createOrbitTelemetryPlugin,
  operatorSwitch: createOperatorSwitchPlugin,
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
