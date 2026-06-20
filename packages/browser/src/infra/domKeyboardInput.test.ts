import type { KeyboardInputProvider } from "@solitude/input/keyboard";
import { describe, expect, it } from "vitest";
import { __domKeyboardInputTest } from "./domKeyboardInput";

describe("domKeyboardInput", () => {
  it("adds plugin key bindings and actions", () => {
    const input: KeyboardInputProvider = {
      actions: ["testFire", "testTrim"],
      keyMap: {
        KeyF: "testFire",
        KeyT: "testTrim",
      },
    };

    const keyMap = __domKeyboardInputTest.buildKeyMap([input]);
    const actions = __domKeyboardInputTest.collectControlActions([input]);

    expect(keyMap.KeyF).toBe("testFire");
    expect(keyMap.KeyT).toBe("testTrim");
    expect(actions).toContain("testFire");
    expect(actions).toContain("testTrim");
  });

  it("collects actions declared only through plugin key maps", () => {
    const input: KeyboardInputProvider = {
      keyMap: {
        KeyF: "testFire",
      },
    };

    const actions = __domKeyboardInputTest.collectControlActions([input]);

    expect(actions).toContain("testFire");
  });
});
