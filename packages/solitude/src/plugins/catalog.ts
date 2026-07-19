import { createHudOverlayPlugin } from "@solitude/browser/dom/hudOverlayPlugin";
import type { PluginCatalog } from "@solitude/engine/plugin";
import { simPluginCatalog } from "@solitude/sim/plugins/catalog";
import { createPausePlugin } from "./pause/index";
import { createPlaybackPlugin } from "./playback/index";
import { createProfilingPlugin } from "./profiling/index";
import { createShipsPlugin } from "./ships/index";
import { createTimeScalePlugin } from "./timeScale/index";

// Plugin order is runtime behavior: later loop/frame-policy plugins can
// override earlier ones, and input handlers are consulted in reverse order.
export const defaultPluginIds = [
  "solarSystem",
  "ships",
  "spacecraftOperator",
  "hud",
  "autopilot",
  "autopilotInput",
  "pause",
  "profiling",
  "timeScale",
  "playback",
];

export const solitudePluginCatalog: PluginCatalog = {
  ...simPluginCatalog,
  hud: createHudOverlayPlugin,
  pause: createPausePlugin,
  playback: createPlaybackPlugin,
  profiling: createProfilingPlugin,
  ships: createShipsPlugin,
  timeScale: createTimeScalePlugin,
};
