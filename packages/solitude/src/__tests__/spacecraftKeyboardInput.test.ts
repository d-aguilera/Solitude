import { __domKeyboardInputTest } from "@solitude/browser/dom/keyboardInput";
import { describe, expect, it } from "vitest";
import { createSpacecraftOperatorPlugin } from "../plugins/spacecraftOperator/index";

describe("spacecraft keyboard input", () => {
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
