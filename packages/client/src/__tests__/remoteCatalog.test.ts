import { loadPlugins } from "@solitude/engine/plugin";
import { keyboardInputCapability } from "@solitude/input/keyboard";
import { describe, expect, it } from "vitest";
import {
  remoteRenderPluginCatalog,
  remoteRenderPluginIds,
} from "../composition";

describe("remote render plugin catalog", () => {
  it("keeps external HUD plugins out of the static host catalog", () => {
    const plugins = loadPlugins({
      catalog: remoteRenderPluginCatalog,
      ids: remoteRenderPluginIds,
    });

    const autopilot = plugins.find((plugin) => plugin.id === "autopilot");
    const autopilotInput = plugins.find(
      (plugin) => plugin.id === "autopilotInput",
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
    expect(plugins.some((plugin) => plugin.id === "autopilotHud")).toBe(false);
    expect(plugins.some((plugin) => plugin.id === "orbitTelemetry")).toBe(
      false,
    );
    expect(plugins.some((plugin) => plugin.id === "shipTelemetry")).toBe(false);
    expect(spacecraftOperator?.capabilities?.length).toBeGreaterThan(0);
  });
});
