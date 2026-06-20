import { describe, expect, it } from "vitest";
import { loadHeadlessPlugins } from "./catalog";

describe("headless plugin catalog", () => {
  it("loads autopilot behavior without input or HUD presentation", () => {
    const [autopilot] = loadHeadlessPlugins(["autopilot"]);

    expect(autopilot.id).toBe("autopilot");
    expect(autopilot.controls).toBeDefined();
    expect(autopilot.input).toBeUndefined();
    expect(
      autopilot.capabilities?.some(({ id }) => id === "hud.panel.v1"),
    ).toBe(false);
  });
});
