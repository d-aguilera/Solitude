import { describe, expect, it } from "vitest";
import { BASE_CONTROL_ACTIONS } from "../app/controlPorts";
import { createSpacecraftOperatorPlugin } from "../plugins/spacecraftOperator/index";
import { __domKeyboardInputTest } from "./domKeyboardInput";

describe("domKeyboardInput", () => {
  it("keeps spacecraft controls out of base actions", () => {
    expect(BASE_CONTROL_ACTIONS).toContain("lookLeft");
    expect(BASE_CONTROL_ACTIONS).toContain("camForward");
    expect(BASE_CONTROL_ACTIONS).not.toContain("burnForward");
    expect(BASE_CONTROL_ACTIONS).not.toContain("rollLeft");
    expect(BASE_CONTROL_ACTIONS).not.toContain("thrust9");
  });

  it("gets spacecraft key bindings from the spacecraft operator plugin", () => {
    const plugin = createSpacecraftOperatorPlugin();
    const input = plugin.input;
    expect(input).toBeDefined();

    const keyMap = __domKeyboardInputTest.buildKeyMap(input ? [input] : []);
    const actions = __domKeyboardInputTest.collectControlActions(
      input ? [input] : [],
    );

    expect(keyMap.Space).toBe("burnForward");
    expect(keyMap.KeyW).toBe("pitchUp");
    expect(keyMap.Digit9).toBe("thrust9");
    expect(actions).toContain("burnForward");
    expect(actions).toContain("pitchUp");
    expect(actions).toContain("thrust9");
  });
});
