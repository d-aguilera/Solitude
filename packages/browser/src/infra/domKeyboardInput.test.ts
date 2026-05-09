import { BASE_CONTROL_ACTIONS } from "@solitude/engine/app/controlPorts";
import type { InputPlugin } from "@solitude/engine/app/pluginPorts";
import { describe, expect, it } from "vitest";
import { __domKeyboardInputTest } from "./domKeyboardInput";

describe("domKeyboardInput", () => {
  it("keeps spacecraft controls out of base actions", () => {
    expect(BASE_CONTROL_ACTIONS).toContain("lookLeft");
    expect(BASE_CONTROL_ACTIONS).toContain("camForward");
    expect(BASE_CONTROL_ACTIONS).not.toContain("burnForward");
    expect(BASE_CONTROL_ACTIONS).not.toContain("rollLeft");
    expect(BASE_CONTROL_ACTIONS).not.toContain("thrust9");
  });

  it("adds plugin key bindings and actions", () => {
    const input: InputPlugin = {
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
});
