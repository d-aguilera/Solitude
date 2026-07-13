import { loadPlugins } from "@solitude/engine/plugin";
import {
  collectKeyboardInputProviders,
  createKeyboardHandlerDispatcher,
  createKeyboardInputProvider,
  keyboardInputCapability,
} from "@solitude/input/keyboard";
import { describe, expect, it } from "vitest";
import {
  createRemoteClientComposition,
  remoteRenderPluginCatalog,
  remoteRenderPluginIds,
} from "../composition";

describe("remote render plugin catalog", () => {
  it("keeps external browser plugins out of the static host catalog", () => {
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
    expect(plugins.some((plugin) => plugin.id === "mainViewLookaround")).toBe(
      false,
    );
    expect(plugins.some((plugin) => plugin.id === "orbitTelemetry")).toBe(
      false,
    );
    expect(plugins.some((plugin) => plugin.id === "shipTelemetry")).toBe(false);
    expect(spacecraftOperator?.capabilities?.length).toBeGreaterThan(0);
  });

  it("composes external view controls into local multiplayer input", () => {
    const updateViewControls = () => {};
    const composition = createRemoteClientComposition({
      clientPlugins: [],
      externalPluginCatalog: {
        mainViewLookaround: () => ({
          id: "mainViewLookaround",
          capabilities: [
            createKeyboardInputProvider({
              actions: ["lookUp"],
              keyMap: { ArrowUp: "lookUp" },
            }),
          ],
          viewControls: { updateViewControls },
        }),
      },
      externalPluginIds: ["mainViewLookaround"],
      runtimeOptions: {},
    });
    const dispatcher = createKeyboardHandlerDispatcher(
      collectKeyboardInputProviders(composition.capabilityRegistry),
    );

    expect(dispatcher.handleKey("ArrowUp", true, false)).toBe(true);
    expect(dispatcher.controlInput.lookUp).toBe(true);
    expect(
      composition.plugins.find((plugin) => plugin.id === "mainViewLookaround")
        ?.viewControls?.updateViewControls,
    ).toBe(updateViewControls);
  });
});
