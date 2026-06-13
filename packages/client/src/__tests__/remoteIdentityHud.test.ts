import {
  createHudGrid,
  getHudColumnIndex,
  hudPanelCapability,
  isHudPanelProvider,
  type HudColumnId,
} from "@solitude/sim/hud/provider";
import { createSolitudeLocalization } from "@solitude/sim/localization";
import { describe, expect, it } from "vitest";
import { createRemoteIdentityHudPlugin } from "../remoteIdentityHud";

describe("remote identity HUD", () => {
  it("publishes game and entity ids", () => {
    const plugin = createRemoteIdentityHudPlugin({
      getEntityId: () => "ship:red",
      getGameId: () => "game:2",
      localization: createSolitudeLocalization("en"),
    });
    const provider = plugin.capabilities?.find(
      (capability) => capability.id === hudPanelCapability,
    )?.value;
    if (!isHudPanelProvider(provider)) {
      throw new Error("Expected a HUD panel provider");
    }

    const grid = createHudGrid();
    provider.writeHud(grid, {} as never);

    expect(columnTexts(grid, "center")).toEqual([
      "Game: game:2",
      "Entity: ship:red",
    ]);
  });
});

function columnTexts(
  grid: ReturnType<typeof createHudGrid>,
  column: HudColumnId,
): string[] {
  return grid.columns[getHudColumnIndex(column)].map((line) => line.text);
}
