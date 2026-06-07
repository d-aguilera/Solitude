import {
  remoteRenderPluginCatalog,
  remoteRenderPluginIds,
} from "@solitude/display/plugins/catalog";
import { loadPlugins } from "@solitude/engine/plugin";
import { hudPanelCapability } from "@solitude/sim/hud/provider";
import { describe, expect, it } from "vitest";

describe("remote render plugin catalog", () => {
  it("includes remote-compatible HUD providers", () => {
    const plugins = loadPlugins({
      catalog: remoteRenderPluginCatalog,
      ids: remoteRenderPluginIds,
    });

    const autopilot = plugins.find((plugin) => plugin.id === "autopilot");
    const shipTelemetry = plugins.find(
      (plugin) => plugin.id === "shipTelemetry",
    );
    const spacecraftOperator = plugins.find(
      (plugin) => plugin.id === "spacecraftOperator",
    );

    expect(
      autopilot?.capabilities?.some(({ id }) => id === hudPanelCapability),
    ).toBe(true);
    expect(
      shipTelemetry?.capabilities?.some(({ id }) => id === hudPanelCapability),
    ).toBe(true);
    expect(spacecraftOperator?.capabilities?.length).toBeGreaterThan(0);
  });
});
