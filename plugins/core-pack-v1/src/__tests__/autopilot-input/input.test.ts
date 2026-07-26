import { describe, expect, it } from "vitest";
import { createInputPlugin } from "../../autopilot-input/input";

describe("autopilot input", () => {
  it("activates one mode at a time", () => {
    const controlInput: Record<string, boolean> = {
      alignToBody: false,
      alignToVelocity: true,
      circleNow: false,
      orbit: false,
    };
    const handler = createInputPlugin().createKeyHandler?.(controlInput, {
      unlockedActions: new Set(),
    });

    expect(handler?.handleKeyDown("alignToBody", false)).toBe(true);
    expect(controlInput).toEqual({
      alignToBody: true,
      alignToVelocity: false,
      circleNow: false,
      orbit: false,
    });
  });

  it("turns an active mode off after its key is released", () => {
    const controlInput: Record<string, boolean> = {
      alignToBody: false,
      alignToVelocity: false,
      circleNow: true,
      orbit: false,
    };
    const handler = createInputPlugin().createKeyHandler?.(controlInput, {
      unlockedActions: new Set(),
    });

    expect(handler?.handleKeyDown("circleNow", false)).toBe(true);
    expect(controlInput.circleNow).toBe(true);
    expect(handler?.handleKeyUp("circleNow")).toBe(true);
    expect(controlInput.circleNow).toBe(false);
  });
});
