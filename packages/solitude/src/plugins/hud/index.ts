import { createBrowserOverlayProvider } from "@solitude/browser/dom/overlayPorts";
import type { GamePlugin } from "@solitude/engine/app/pluginPorts";
import {
  hudPanelCapability,
  isHudPanelProvider,
  type HudPanelProvider,
} from "./capabilities";
import { clearHudGrid, createHudGrid } from "./grid";

export function createHudPlugin(): GamePlugin {
  const grid = createHudGrid();
  let providers: readonly HudPanelProvider[] | null = null;
  let lastHudTimeMs = 0;

  return {
    id: "hud",
    capabilities: [
      createBrowserOverlayProvider({
        renderOverlay: (context, capabilityRegistry) => {
          providers ??= capabilityRegistry
            .getAll(hudPanelCapability)
            .filter(isHudPanelProvider);

          if (context.advanceOverlay) {
            clearHudGrid(grid);
            for (const provider of providers) {
              provider.writeHud(grid, context);
            }
            lastHudTimeMs = context.nowMs;
          }

          if (lastHudTimeMs > 0 && context.primaryOverlayRasterizer) {
            context.primaryOverlayRasterizer.drawHud(grid);
          }
        },
      }),
    ],
  };
}
