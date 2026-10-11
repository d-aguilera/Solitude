import type { GamePlugin } from "@solitude/engine/plugin";
import { createKeyboardInputProvider } from "@solitude/input/keyboard";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBrowserKeyboardHost,
  initInput,
} from "../../infra/domKeyboardInput";

describe("DOM keyboard host", () => {
  let windowTarget: EventTarget;
  let documentTarget: EventTarget & { visibilityState: string };
  beforeEach(() => {
    windowTarget = new EventTarget();
    documentTarget = Object.assign(new EventTarget(), {
      visibilityState: "visible",
    });
    vi.stubGlobal("window", windowTarget);
    vi.stubGlobal("document", documentTarget);
  });
  afterEach(() => vi.unstubAllGlobals());
  const plugin: GamePlugin = {
    id: "testInput",
    capabilities: [
      createKeyboardInputProvider({ keyMap: { KeyF: "testFire" } }),
    ],
  };
  function key(
    type: string,
    code = "KeyF",
    repeat = false,
    target: unknown = windowTarget,
  ): Event {
    const event = Object.assign(new Event(type, { cancelable: true }), {
      code,
      repeat,
    });
    Object.defineProperty(event, "target", { value: target });
    windowTarget.dispatchEvent(event);
    return event;
  }
  it("preserves native button activation without thrust, repeats or a consumed release", () => {
    const host = createBrowserKeyboardHost();
    const input = initInput(
      [
        {
          id: "flightInput",
          capabilities: [
            createKeyboardInputProvider({
              keyMap: { Space: "thrust", Enter: "enter" },
            }),
          ],
        },
      ],
      host,
    );
    const button = { tagName: "BUTTON" };
    for (const code of ["Space", "Enter"]) {
      expect(key("keydown", code, false, button).defaultPrevented).toBe(false);
      expect(key("keydown", code, true, button).defaultPrevented).toBe(false);
      expect(key("keyup", code, false, button).defaultPrevented).toBe(false);
    }
    expect(input.controlInput.thrust).not.toBe(true);
    expect(input.controlInput.enter).not.toBe(true);
    key("keydown", "Space");
    expect(input.controlInput.thrust).toBe(true);
    // Moving focus to a button during a held burn must still release that burn.
    key("keyup", "Space", false, button);
    expect(input.controlInput.thrust).toBe(false);
    input.dispose();
    host.dispose();
  });
  it("dispatches mapped keys, leaving unmapped events alone", () => {
    const host = createBrowserKeyboardHost();
    const input = initInput([plugin], host);
    expect(key("keydown").defaultPrevented).toBe(true);
    expect(input.controlInput.testFire).toBe(true);
    expect(key("keyup").defaultPrevented).toBe(true);
    expect(input.controlInput.testFire).toBe(false);
    expect(key("keydown", "Unknown").defaultPrevented).toBe(false);
    input.dispose();
    host.dispose();
  });
  it("clears direct controls and pending handlers, requiring release after reset", () => {
    const reset = vi.fn();
    const host = createBrowserKeyboardHost();
    const input = initInput(
      [
        {
          ...plugin,
          capabilities: [
            createKeyboardInputProvider({
              keyMap: { KeyF: "testFire" },
              createKeyHandler: () => ({
                handleKeyDown: () => false,
                handleKeyUp: () => false,
                reset,
              }),
            }),
          ],
        },
      ],
      host,
    );
    key("keydown");
    input.controlInput.directRequest = true;
    input.clear();
    expect(input.controlInput).toEqual({
      testFire: false,
      directRequest: false,
    });
    expect(reset).toHaveBeenCalledTimes(1);
    key("keydown", "KeyF", true);
    key("keydown");
    expect(input.controlInput.testFire).toBe(false);
    key("keyup");
    key("keydown");
    expect(input.controlInput.testFire).toBe(true);
    input.dispose();
    host.dispose();
  });
  it("retains the release gate across runtime replacement and keys released in the menu", () => {
    const host = createBrowserKeyboardHost();
    const old = initInput([plugin], host);
    key("keydown");
    old.dispose();
    old.dispose();
    const fresh = initInput([plugin], host);
    key("keydown", "KeyF", true);
    expect(fresh.controlInput.testFire).toBe(false);
    key("keyup");
    key("keydown");
    expect(fresh.controlInput.testFire).toBe(true);
    expect(old.controlInput.testFire).toBe(false);
    fresh.dispose();
    key("keyup");
    const third = initInput([plugin], host);
    key("keydown");
    expect(third.controlInput.testFire).toBe(true);
    third.dispose();
    host.dispose();
  });
  it("clears input on focus/visibility loss and removes all listeners on pagehide", () => {
    const removeWindow = vi.spyOn(windowTarget, "removeEventListener");
    const removeDocument = vi.spyOn(documentTarget, "removeEventListener");
    const host = createBrowserKeyboardHost();
    const input = initInput([plugin], host);
    key("keydown");
    windowTarget.dispatchEvent(new Event("blur"));
    expect(input.controlInput.testFire).toBe(false);
    key("keyup");
    key("keydown");
    documentTarget.visibilityState = "hidden";
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    expect(input.controlInput.testFire).toBe(false);
    windowTarget.dispatchEvent(new Event("pagehide"));
    host.dispose();
    key("keyup");
    key("keydown");
    expect(input.controlInput.testFire).toBe(false);
    expect(removeWindow).toHaveBeenCalledTimes(4);
    expect(removeDocument).toHaveBeenCalledTimes(1);
    expect(() => initInput([], host)).toThrow("disposed");
    input.dispose();
  });
  it("rejects concurrent bindings and ignores orphaned repeats", () => {
    const host = createBrowserKeyboardHost();
    const input = initInput([plugin], host);
    expect(() => initInput([plugin], host)).toThrow("active runtime");
    key("keydown", "KeyF", true);
    expect(input.controlInput.testFire).toBe(false);
    key("keyup");
    key("keydown");
    expect(input.controlInput.testFire).toBe(true);
    input.dispose();
    host.dispose();
  });
});
