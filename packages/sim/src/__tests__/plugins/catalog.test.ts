import { loadPlugins } from "@solitude/engine/plugin";
import { keyboardInputCapability } from "@solitude/input/keyboard";
import { describe, expect, it } from "vitest";
import { simPluginCatalog } from "../../plugins/catalog";

describe("simulation plugin catalog", () => {
  it("loads autopilot behavior without input or HUD presentation", () => {
    const [autopilot] = loadPlugins({
      catalog: simPluginCatalog,
      ids: ["autopilot"],
    });

    expect(autopilot.id).toBe("autopilot");
    expect(autopilot.controls).toBeDefined();
    expect(
      autopilot.capabilities?.some(({ id }) => id === "hud.panel.v1"),
    ).toBe(false);
    expect(
      autopilot.capabilities?.some(({ id }) => id === keyboardInputCapability),
    ).toBe(false);
  });
});
