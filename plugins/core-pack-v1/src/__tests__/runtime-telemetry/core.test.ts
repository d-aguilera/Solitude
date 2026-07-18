import {
  isPresentationFrameProvider,
  presentationFrameCapability,
} from "@solitude/plugin-api/presentation";
import { describe, expect, it } from "vitest";
import { createPlugin } from "../../runtime-telemetry/index";
import {
  columnTexts,
  createTestHudContext,
  createTestHudGrid,
  createTestWorldAndBody,
  getHudPanel,
} from "../shared/hudTest";

describe("runtime telemetry plugin", () => {
  it("samples presentation frames and publishes simulation time and fps", () => {
    const plugin = createPlugin({ locale: "en" });
    const frameProvider = plugin.capabilities?.find(
      (capability) => capability.id === presentationFrameCapability,
    )?.value;
    if (!isPresentationFrameProvider(frameProvider)) {
      throw new Error("Expected a presentation frame provider");
    }
    frameProvider.updatePresentationFrame({
      dtMillis: 1000 / 60,
      nowMs: 1234,
    });

    const { body, world } = createTestWorldAndBody();
    const grid = createTestHudGrid();
    getHudPanel(plugin).writeHud(grid, createTestHudContext(world, body));

    expect(columnTexts(grid, "center")).toEqual(["Time: 01m 05s", "FPS: 60.0"]);
  });

  it("localizes telemetry independently of either browser host", () => {
    const plugin = createPlugin({ locale: "fr" });
    const { body, world } = createTestWorldAndBody();
    const grid = createTestHudGrid();

    getHudPanel(plugin).writeHud(grid, createTestHudContext(world, body));

    expect(columnTexts(grid, "center")).toEqual([
      "Temps : 01m 05s",
      "IPS : 0,0",
    ]);
  });
});
