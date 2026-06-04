import {
  createHudGrid,
  hudPanelCapability,
  isHudPanelProvider,
} from "@solitude/sim/hud/provider";
import { describe, expect, it } from "vitest";
import { createRemoteIdentityHudPlugin } from "../remoteIdentityHud";

describe("remote identity HUD", () => {
  it("publishes game and entity ids", () => {
    const plugin = createRemoteIdentityHudPlugin({
      getEntityId: () => "ship:red",
      getGameId: () => "game:2",
    });
    const provider = plugin.capabilities?.find(
      (capability) => capability.id === hudPanelCapability,
    )?.value;
    if (!isHudPanelProvider(provider)) {
      throw new Error("Expected a HUD panel provider");
    }

    const grid = createHudGrid();
    provider.writeHud(grid, {} as never);

    expect(grid[3][0]).toBe("Game: game:2");
    expect(grid[4][0]).toBe("Entity: ship:red");
  });
});
