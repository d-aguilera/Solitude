import { loadPlugins } from "@solitude/engine/plugin";
import { keyboardInputCapability } from "@solitude/input/keyboard";
import { describe, expect, it } from "vitest";
import { defaultPluginIds, solitudePluginCatalog } from "../catalog";

describe("solitude plugin catalog", () => {
  it("keeps the external autopilot HUD out of the static host catalog", () => {
    const plugins = loadPlugins({
      catalog: solitudePluginCatalog,
      ids: defaultPluginIds,
    });

    const autopilot = plugins.find((plugin) => plugin.id === "autopilot");
    const autopilotInput = plugins.find(
      (plugin) => plugin.id === "autopilotInput",
    );

    expect(autopilot?.controls).toBeDefined();
    expect(
      autopilotInput?.capabilities?.some(
        ({ id }) => id === keyboardInputCapability,
      ),
    ).toBe(true);
    expect(plugins.some((plugin) => plugin.id === "autopilotHud")).toBe(false);
  });
});
