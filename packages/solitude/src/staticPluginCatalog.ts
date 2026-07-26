import { createBrowserHudOverlayAdapter } from "@solitude/browser/dom/hudOverlayAdapter";
import type { PluginCatalog } from "@solitude/engine/plugin";
import { simPluginCatalog } from "@solitude/sim/plugins/catalog";

// Plugin order is runtime behavior: later loop/frame-policy plugins can
// override earlier ones, and input handlers are consulted in reverse order.
export const staticPluginIds = [
  "spacecraftOperator",
  "browserHudOverlay",
  "autopilot",
];

export const staticPluginCatalog: PluginCatalog = {
  ...simPluginCatalog,
  browserHudOverlay: createBrowserHudOverlayAdapter,
};
