import { createHudOverlayPlugin } from "@solitude/browser/dom/hudOverlayPlugin";
import type { PluginCatalog } from "@solitude/engine/plugin";
import { simPluginCatalog } from "@solitude/sim/plugins/catalog";
import { createMemoryPlugin } from "./memory/index";
import { createOperatorSwitchPlugin } from "./operatorSwitch/index";
import { createPausePlugin } from "./pause/index";
import { createPlaybackPlugin } from "./playback/index";
import { createProfilingPlugin } from "./profiling/index";
import { createShipsPlugin } from "./ships/index";
import { createTimeScalePlugin } from "./timeScale/index";

// Plugin order is runtime behavior: later loop/frame-policy plugins can
// override earlier ones, and input handlers are consulted in reverse order.
export const defaultPluginIds = [
  "solarSystem",
  "polyFighter",
  "ships",
  "spacecraftOperator",
  "hud",
  "autopilot",
  "autopilotInput",
  "memory",
  "pause",
  "profiling",
  "timeScale",
  "playback",
  "operatorSwitch",
];

export const solitudePluginCatalog: PluginCatalog = {
  ...simPluginCatalog,
  hud: createHudOverlayPlugin,
  memory: createMemoryPlugin,
  operatorSwitch: createOperatorSwitchPlugin,
  pause: createPausePlugin,
  playback: createPlaybackPlugin,
  profiling: createProfilingPlugin,
  ships: createShipsPlugin,
  timeScale: createTimeScalePlugin,
};
