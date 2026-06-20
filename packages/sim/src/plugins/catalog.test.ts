import { describe, expect, it } from "vitest";
import { keyboardInputCapability } from "@solitude/input/keyboard";
import { loadHeadlessPlugins } from "./catalog";

describe("headless plugin catalog", () => {
  it("loads autopilot behavior without input or HUD presentation", () => {
    const [autopilot] = loadHeadlessPlugins(["autopilot"]);

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
