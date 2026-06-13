import {
  createHudGrid,
  getHudColumnIndex,
  hudPanelCapability,
  isHudPanelProvider,
} from "@solitude/sim/hud/provider";
import { describe, expect, it } from "vitest";
import { createClientLocalization } from "../localization";
import { createRemoteRuntimeTelemetryHudPlugin } from "../remoteRuntimeTelemetryHud";

describe("remote runtime telemetry HUD", () => {
  it("publishes simulation time and fps in the center column", () => {
    const telemetry = createRemoteRuntimeTelemetryHudPlugin(
      createClientLocalization("en"),
    );
    telemetry.updateFps(1000 / 60);

    const provider = telemetry.plugin.capabilities?.find(
      (capability) => capability.id === hudPanelCapability,
    )?.value;
    if (!isHudPanelProvider(provider)) {
      throw new Error("Expected a HUD panel provider");
    }

    const grid = createHudGrid();
    provider.writeHud(grid, { simTimeMillis: 65_000 } as never);

    expect(
      grid.columns[getHudColumnIndex("center")].map((line) => line.text),
    ).toEqual(["Time: 01m 05s", "FPS: 60.0"]);
  });
});
