import { createBrowserHudOverlayAdapter } from "@solitude/browser/dom/hudOverlayAdapter";
import type { PluginCatalog } from "@solitude/engine/plugin";

// Plugin order is runtime behavior: later loop/frame-policy plugins can
// override earlier ones, and input handlers are consulted in reverse order.
export const staticPluginIds = ["browserHudOverlay"];

export const staticPluginCatalog: PluginCatalog = {
  browserHudOverlay: createBrowserHudOverlayAdapter,
};
