import type { PluginCapabilityProvider } from "@solitude/engine/plugin";
import { describe, expect, it } from "vitest";
import {
  collectKeyboardInputProviders,
  createKeyboardHandlerDispatcher,
  createKeyboardInputProvider,
  type KeyboardInputProvider,
} from "./keyboard";

describe("keyboard input providers", () => {
  it("collects capability-backed providers in plugin order", () => {
    const first: KeyboardInputProvider = { keyMap: { KeyA: "first" } };
    const second: KeyboardInputProvider = { keyMap: { KeyB: "second" } };
    const capabilities: PluginCapabilityProvider[] = [
      createKeyboardInputProvider(first),
      { id: "unrelated", value: {} },
      createKeyboardInputProvider(second),
    ];

    expect(collectKeyboardInputProviders(capabilities)).toEqual([
      first,
      second,
    ]);
  });
});

describe("createKeyboardHandlerDispatcher", () => {
  it("routes a mapped key to its provider-owned handler", () => {
    let toggles = 0;
    const dispatcher = createKeyboardHandlerDispatcher([
      {
        keyMap: { KeyT: "toggle" },
        createKeyHandler: () => ({
          handleKeyDown: (action, repeat) => {
            if (action !== "toggle") return false;
            if (!repeat) toggles++;
            return true;
          },
          handleKeyUp: (action) => action === "toggle",
        }),
      },
    ]);

    expect(dispatcher.handleKey("KeyT", true, false)).toBe(true);
    expect(dispatcher.handleKey("KeyT", true, true)).toBe(true);
    expect(dispatcher.handleKey("KeyT", false, false)).toBe(true);
    expect(toggles).toBe(1);
  });
});
