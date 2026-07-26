import { createHudOverlayPlugin } from "@solitude/browser/dom/hudOverlayPlugin";
import type { PluginCatalog } from "@solitude/engine/plugin";
import { simPluginCatalog } from "@solitude/sim/plugins/catalog";

// Plugin order is runtime behavior: later loop/frame-policy plugins can
// override earlier ones, and input handlers are consulted in reverse order.
export const staticPluginIds = [
  "solarSystem",
  "spacecraftOperator",
  "hud",
  "autopilot",
  "autopilotInput",
];

export const staticPluginCatalog: PluginCatalog = {
  ...simPluginCatalog,
  hud: createHudOverlayPlugin,
};
