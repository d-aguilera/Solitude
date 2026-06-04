import type { PluginCatalog } from "@solitude/engine/plugin";
import { createAutopilotPlugin } from "@solitude/sim/plugins/autopilot";
import { createPolyFighterPlugin } from "@solitude/sim/plugins/polyFighter";
import { createSolarSystemPlugin } from "@solitude/sim/plugins/solarSystem";
import { createSpacecraftOperatorPlugin } from "@solitude/sim/plugins/spacecraftOperator";
import { createAxialViewsPlugin } from "./axialViews/index";
import { createBodyLabelsPlugin } from "./bodyLabels/index";
import { createHudPlugin } from "./hud/index";
import { createMainViewLookaroundPlugin } from "./mainViewLookaround/index";
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
import { createShipsPlugin } from "./ships/index";
import { createTimeScalePlugin } from "./timeScale/index";
import { createTrajectoriesPlugin } from "./trajectories/index";
import { createVelocitySegmentsPlugin } from "./velocitySegments/index";

// Plugin order is runtime behavior: later loop/frame-policy plugins can
// override earlier ones, and input handlers are consulted in reverse order.
export const defaultPluginIds = [
  "solarSystem",
  "polyFighter",
  "ships",
  "mainViewLookaround",
  "spacecraftOperator",
  "hud",
  "bodyLabels",
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

export const remoteRenderPluginIds = [
  "solarSystem",
  "spacecraftOperator",
  "hud",
  "orbitTelemetry",
  "shipTelemetry",
  "autopilot",
  "bodyLabels",
  "axialViews",
  "trajectories",
  "velocitySegments",
];

export const solitudePluginCatalog: PluginCatalog<PluginCompositionContext> = {
  autopilot: createAutopilotPlugin,
  axialViews: createAxialViewsPlugin,
  bodyLabels: createBodyLabelsPlugin,
  hud: createHudPlugin,
  mainViewLookaround: createMainViewLookaroundPlugin,
  memory: createMemoryPlugin,
  orbitTelemetry: createOrbitTelemetryPlugin,
  operatorSwitch: createOperatorSwitchPlugin,
  pause: createPausePlugin,
  playback: createPlaybackPlugin,
  polyFighter: createPolyFighterPlugin,
  profiling: createProfilingPlugin,
  runtimeTelemetry: createRuntimeTelemetryPlugin,
  shipTelemetry: createShipTelemetryPlugin,
  solarSystem: createSolarSystemPlugin,
  spacecraftOperator: createSpacecraftOperatorPlugin,
  ships: createShipsPlugin,
  timeScale: createTimeScalePlugin,
  trajectories: createTrajectoriesPlugin,
  velocitySegments: createVelocitySegmentsPlugin,
};

export { createPluginCompositionContext };
