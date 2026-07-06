import { loadPlugins } from "@solitude/engine/plugin";
import { hudPanelCapability } from "@solitude/hud/provider";
import { keyboardInputCapability } from "@solitude/input/keyboard";
import { describe, expect, it } from "vitest";
import {
  remoteRenderPluginCatalog,
  remoteRenderPluginIds,
} from "../composition";

describe("remote render plugin catalog", () => {
  it("composes remote sim behavior separately from display HUD providers", () => {
    const plugins = loadPlugins({
      catalog: remoteRenderPluginCatalog,
      ids: remoteRenderPluginIds,
    });

    const autopilot = plugins.find((plugin) => plugin.id === "autopilot");
    const autopilotHud = plugins.find((plugin) => plugin.id === "autopilotHud");
    const autopilotInput = plugins.find(
      (plugin) => plugin.id === "autopilotInput",
    );
    const shipTelemetry = plugins.find(
      (plugin) => plugin.id === "shipTelemetry",
    );
    const spacecraftOperator = plugins.find(
      (plugin) => plugin.id === "spacecraftOperator",
    );

    expect(autopilot?.controls).toBeDefined();
    expect(
      autopilotInput?.capabilities?.some(
        ({ id }) => id === keyboardInputCapability,
      ),
    ).toBe(true);
    expect(
      autopilotHud?.capabilities?.some(({ id }) => id === hudPanelCapability),
    ).toBe(true);
    expect(
      shipTelemetry?.capabilities?.some(({ id }) => id === hudPanelCapability),
    ).toBe(true);
    expect(spacecraftOperator?.capabilities?.length).toBeGreaterThan(0);
  });
});
