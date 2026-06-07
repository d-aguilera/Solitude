import {
  createPluginCapabilityProvider,
  type BrowserOverlayContext,
  type BrowserOverlayProvider,
} from "@solitude/browser/dom/overlayPorts";
import type {
  GamePlugin,
  PluginCapabilityRegistry,
} from "@solitude/engine/plugin";
import {
  clearHudGrid,
  createHudGrid,
  hudPanelCapability,
  isHudPanelProvider,
  type HudContext,
  type HudPanelProvider,
} from "@solitude/sim/hud/provider";

export function createHudPlugin(): GamePlugin {
  const grid = createHudGrid();
  const hudContextScratch = {} as HudContext;
  let providers: readonly HudPanelProvider[] | null = null;

  const renderOverlay = (
    context: BrowserOverlayContext,
    capabilityRegistry: PluginCapabilityRegistry,
  ) => {
    providers ??= capabilityRegistry
      .getAll(hudPanelCapability)
      .filter(isHudPanelProvider);

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

    context.primaryOverlayRasterizer?.drawHud(grid);
  };

  const provider: BrowserOverlayProvider = { renderOverlay };

  return {
    id: "hud",
    capabilities: [createPluginCapabilityProvider(provider)],
  };
}
