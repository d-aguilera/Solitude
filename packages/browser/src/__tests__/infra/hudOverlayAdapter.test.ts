import {
  hudHighlightCapability,
  hudPanelCapability,
  type HudGrid,
} from "@solitude/hud/provider";
import { expect, it, vi } from "vitest";
import { createBrowserHudOverlayAdapter } from "../../infra/hudOverlayAdapter";
import {
  collectBrowserOverlayProviders,
  type BrowserOverlayContext,
} from "../../infra/overlayPorts";

it("applies semantic highlights after panel composition and clears them even without a HUD advance", () => {
  let active = true;
  const capabilities = [
    {
      id: hudHighlightCapability,
      value: {
        isHighlighted: (key: string) =>
          active && key === "orbit.periapsisAltitude",
      },
    },
    {
      id: hudPanelCapability,
      value: {
        writeHud: (grid: HudGrid) => {
          grid.addLine("left", "orbit.periapsisAltitude", "Pe alt: -50 km");
          grid.addLine("left", "orbit.distance", "d: 6771 km");
        },
      },
    },
    ...createBrowserHudOverlayAdapter().capabilities!,
  ];
  const registry = {
    getAll: (id: string) =>
      capabilities
        .filter((provider) => provider.id === id)
        .map((provider) => provider.value),
  };
  const drawHud = vi.fn();
  const context = {
    advanceOverlay: true,
    primaryOverlayRasterizer: { drawHud, beginFrame: vi.fn() },
  } as unknown as BrowserOverlayContext;
  const provider = collectBrowserOverlayProviders(registry)[0];
  provider.renderOverlay(context, registry);
  const grid = drawHud.mock.calls[0][0] as HudGrid;
  expect(grid.columns[0].map((line) => line.emphasized)).toEqual([true, false]);
  active = false;
  context.advanceOverlay = false;
  provider.renderOverlay(context, registry);
  expect(grid.columns[0].map((line) => line.emphasized)).toEqual([
    false,
    false,
  ]);
});
