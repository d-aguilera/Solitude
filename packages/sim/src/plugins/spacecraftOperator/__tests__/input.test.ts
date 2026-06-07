import { describe, expect, it } from "vitest";
import { createInputPlugin } from "../input";

describe("spacecraft operator input", () => {
  it("declares spacecraft control actions and key bindings", () => {
    const input = createInputPlugin();

    expect(input.keyMap?.Space).toBe("burnForward");
    expect(input.keyMap?.KeyW).toBe("pitchUp");
    expect(input.keyMap?.Digit9).toBe("thrust9");
    expect(input.actions).toContain("burnForward");
    expect(input.actions).toContain("pitchUp");
    expect(input.actions).toContain("thrust9");
  });
});
