import { loadPlugins } from "@solitude/engine/plugin";
import { hudPanelCapability } from "@solitude/sim/hud/provider";
import { describe, expect, it } from "vitest";
import {
  createPluginCompositionContext,
  remoteRenderPluginIds,
  solitudePluginCatalog,
} from "../catalog";

describe("remote render plugin catalog", () => {
  it("includes remote-compatible HUD providers", () => {
    const plugins = loadPlugins({
      catalog: solitudePluginCatalog,
      context: createPluginCompositionContext(),
      ids: remoteRenderPluginIds,
    });

    const autopilot = plugins.find((plugin) => plugin.id === "autopilot");
    const shipTelemetry = plugins.find(
      (plugin) => plugin.id === "shipTelemetry",
    );

    expect(
      autopilot?.capabilities?.some(({ id }) => id === hudPanelCapability),
    ).toBe(true);
    expect(
      shipTelemetry?.capabilities?.some(({ id }) => id === hudPanelCapability),
    ).toBe(true);
  });
});
