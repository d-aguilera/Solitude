import { loadPlugins } from "@solitude/engine/plugin";
import { describe, expect, it } from "vitest";
import { staticPluginCatalog, staticPluginIds } from "../staticPluginCatalog";

describe("static plugin catalog", () => {
  it("contains only the remaining host-composed plugins", () => {
    const plugins = loadPlugins({
      catalog: staticPluginCatalog,
      ids: staticPluginIds,
    });

    const browserHudOverlay = plugins.find(
      (plugin) => plugin.id === "browserHudOverlay",
    );

    expect(browserHudOverlay?.capabilities).toHaveLength(1);
    expect(plugins.some((plugin) => plugin.id === "spacecraftOperator")).toBe(
      false,
    );
    expect(plugins.some((plugin) => plugin.id === "autopilot")).toBe(false);
    expect(plugins.some((plugin) => plugin.id === "solarSystem")).toBe(false);
    expect(plugins.some((plugin) => plugin.id === "autopilotInput")).toBe(
      false,
    );
    expect(plugins.some((plugin) => plugin.id === "autopilotHud")).toBe(false);
    expect(plugins.some((plugin) => plugin.id === "mainViewLookaround")).toBe(
      false,
    );
    expect(plugins.some((plugin) => plugin.id === "runtimeTelemetry")).toBe(
      false,
    );
    expect(plugins.some((plugin) => plugin.id === "memory")).toBe(false);
    expect(plugins.some((plugin) => plugin.id === "profiling")).toBe(false);
    expect(plugins.some((plugin) => plugin.id === "pause")).toBe(false);
    expect(plugins.some((plugin) => plugin.id === "playback")).toBe(false);
    expect(plugins.some((plugin) => plugin.id === "timeScale")).toBe(false);
    expect(plugins.some((plugin) => plugin.id === "ships")).toBe(false);
    expect(plugins.some((plugin) => plugin.id === "polyFighter")).toBe(false);
    expect(plugins.some((plugin) => plugin.id === "operatorSwitch")).toBe(
      false,
    );
  });
});
