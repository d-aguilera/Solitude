import type { ExternalPluginCapabilityProvider } from "@solitude/plugin-api/capabilities";
import type {
  ExternalHudContext,
  ExternalHudGrid,
} from "@solitude/plugin-api/hud";
import {
  hudPanelCapability,
  isHudPanelProvider,
} from "@solitude/plugin-api/hud";
import { createMultiplayerSessionCapability } from "@solitude/plugin-api/multiplayer";
import { describe, expect, it } from "vitest";
import { createPlugin } from "./index";

describe("remote identity HUD plugin", () => {
  it("publishes live multiplayer game and entity ids", () => {
    const plugin = createPlugin({ locale: "en" });
    const panel = plugin.capabilities?.find(
      (capability) => capability.id === hudPanelCapability,
    )?.value;
    if (!isHudPanelProvider(panel)) throw new Error("Expected a HUD panel");
    const capabilities = [
      createMultiplayerSessionCapability({
        getEntityId: () => "ship:red",
        getGameId: () => "game:2",
      }),
    ];
    const lines: string[] = [];
    const grid = createTestGrid(lines);

    panel.writeHud(grid, createTestContext(capabilities));

    expect(lines).toEqual(["Game: game:2", "Entity: ship:red"]);
  });
});

function createTestGrid(lines: string[]): ExternalHudGrid {
  return {
    addLine: (_column, _key, text) => lines.push(text),
    appendLine: () => {},
  };
}

function createTestContext(
  capabilities: readonly ExternalPluginCapabilityProvider[],
): ExternalHudContext {
  return {
    capabilityRegistry: {
      getAll: (id: string) =>
        capabilities
          .filter((capability) => capability.id === id)
          .map((capability) => capability.value),
    },
  } as unknown as ExternalHudContext;
}
