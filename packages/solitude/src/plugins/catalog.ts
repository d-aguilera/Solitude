import { createHudOverlayPlugin } from "@solitude/browser/dom/hudOverlayPlugin";
import type { PluginCatalog } from "@solitude/engine/plugin";
import { simPluginCatalog } from "@solitude/sim/plugins/catalog";
import { createPlaybackPlugin } from "./playback/index";
import { createTimeScalePlugin } from "./timeScale/index";

// Plugin order is runtime behavior: later loop/frame-policy plugins can
// override earlier ones, and input handlers are consulted in reverse order.
export const defaultPluginIds = [
  "solarSystem",
  "spacecraftOperator",
  "hud",
  "autopilot",
  "autopilotInput",
  "timeScale",
  "playback",
];

export const solitudePluginCatalog: PluginCatalog = {
  ...simPluginCatalog,
  hud: createHudOverlayPlugin,
  playback: createPlaybackPlugin,
  timeScale: createTimeScalePlugin,
};
