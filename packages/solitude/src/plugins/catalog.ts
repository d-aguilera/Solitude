import { createHudOverlayPlugin } from "@solitude/browser/dom/hudOverlayPlugin";
import { displayPluginCatalog } from "@solitude/display/plugins/catalog";
import type { PluginCatalog } from "@solitude/engine/plugin";
import { createAutopilotPlugin } from "@solitude/sim/plugins/autopilot";
import { createPolyFighterPlugin } from "@solitude/sim/plugins/polyFighter";
import { createSolarSystemPlugin } from "@solitude/sim/plugins/solarSystem";
import { createSpacecraftOperatorPlugin } from "@solitude/sim/plugins/spacecraftOperator";
import { createMainViewLookaroundPlugin } from "./mainViewLookaround/index";
import { createMemoryPlugin } from "./memory/index";
import { createOperatorSwitchPlugin } from "./operatorSwitch/index";
import { createPausePlugin } from "./pause/index";
import { createPlaybackPlugin } from "./playback/index";
import { createProfilingPlugin } from "./profiling/index";
import { createRuntimeTelemetryPlugin } from "./runtimeTelemetry/index";
import { createShipsPlugin } from "./ships/index";
import { createTimeScalePlugin } from "./timeScale/index";

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

export const solitudePluginCatalog: PluginCatalog = {
  ...displayPluginCatalog,
  autopilot: createAutopilotPlugin,
  hud: createHudOverlayPlugin,
  mainViewLookaround: createMainViewLookaroundPlugin,
  memory: createMemoryPlugin,
  operatorSwitch: createOperatorSwitchPlugin,
  pause: createPausePlugin,
  playback: createPlaybackPlugin,
  polyFighter: createPolyFighterPlugin,
  profiling: createProfilingPlugin,
  runtimeTelemetry: createRuntimeTelemetryPlugin,
  solarSystem: createSolarSystemPlugin,
  spacecraftOperator: createSpacecraftOperatorPlugin,
  ships: createShipsPlugin,
  timeScale: createTimeScalePlugin,
};
