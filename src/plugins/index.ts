import type { GamePlugin } from "../app/pluginPorts";
import { createAutopilotPlugin } from "./autopilot/index";
import { createMemoryPlugin } from "./memory/index";
import { createOrbitTelemetryPlugin } from "./orbitTelemetry/index";
import { createPausePlugin } from "./pause/index";
import { createProfilingPlugin } from "./profiling/index";
import { createRuntimeTelemetryPlugin } from "./runtimeTelemetry/index";
import { createShipTelemetryPlugin } from "./shipTelemetry/index";
import { createTimeScalePlugin } from "./timeScale/index";
import { createTrajectoriesPlugin } from "./trajectories/index";
import { createVelocitySegmentsPlugin } from "./velocitySegments/index";

export type PluginFactory = () => GamePlugin;

export const availablePlugins: Record<string, PluginFactory> = {
  autopilot: createAutopilotPlugin,
  memory: createMemoryPlugin,
  orbitTelemetry: createOrbitTelemetryPlugin,
  pause: createPausePlugin,
  profiling: createProfilingPlugin,
  runtimeTelemetry: createRuntimeTelemetryPlugin,
  shipTelemetry: createShipTelemetryPlugin,
  timeScale: createTimeScalePlugin,
  trajectories: createTrajectoriesPlugin,
  velocitySegments: createVelocitySegmentsPlugin,
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
