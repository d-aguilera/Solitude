import type {
  GamePlugin,
  PluginCapabilityRegistry,
} from "@solitude/engine/plugin";
import {
  clearHudGrid,
  createHudGrid,
  hudHighlightCapability,
  hudPanelCapability,
  isHudHighlightProvider,
  isHudPanelProvider,
  type HudContext,
  type HudHighlightProvider,
  type HudPanelProvider,
} from "@solitude/hud/provider";
import {
  createBrowserOverlayCapabilityProvider,
  type BrowserOverlayContext,
  type BrowserOverlayProvider,
} from "./overlayPorts";

export function createBrowserHudOverlayAdapter(): GamePlugin {
  const grid = createHudGrid();
  const hudContextScratch = {} as HudContext;
  let highlights: readonly HudHighlightProvider[] | null = null;
  let providers: readonly HudPanelProvider[] | null = null;

  const renderOverlay = (
    context: BrowserOverlayContext,
    capabilityRegistry: PluginCapabilityRegistry,
  ) => {
    providers ??= capabilityRegistry
      .getAll(hudPanelCapability)
      .filter(isHudPanelProvider);

    highlights ??= capabilityRegistry
      .getAll(hudHighlightCapability)
      .filter(isHudHighlightProvider);

    if (context.advanceOverlay) {
      clearHudGrid(grid);
      hudContextScratch.capabilityRegistry = capabilityRegistry;
      hudContextScratch.controlInput = context.controlInput;
      hudContextScratch.mainFocus = context.mainFocus;
      hudContextScratch.nowMs = context.nowMs;
      hudContextScratch.simTimeMillis = context.simTimeMillis;
      hudContextScratch.world = context.world;
      for (const provider of providers) {
        provider.writeHud(grid, hudContextScratch);
      }
    }

    for (const column of grid.columns) {
      for (const line of column) {
        line.emphasized = false;
        for (const provider of highlights) {
          if (provider.isHighlighted(line.key)) {
            line.emphasized = true;
            break;
          }
        }
      }
    }
    context.primaryOverlayRasterizer?.drawHud(grid);
  };

  const provider: BrowserOverlayProvider = { renderOverlay };

  return {
    id: "browserHudOverlay",
    capabilities: [createBrowserOverlayCapabilityProvider(provider)],
  };
}
