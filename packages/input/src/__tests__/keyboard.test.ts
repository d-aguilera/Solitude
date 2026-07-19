import type { PluginCapabilityProvider } from "@solitude/engine/plugin";
import { describe, expect, it } from "vitest";
import {
  collectKeyboardInputProviders,
  createKeyboardHandlerDispatcher,
  createKeyboardInputProvider,
  type KeyboardInputProvider,
} from "../keyboard";

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

  it("exposes provider-owned local control state", () => {
    const dispatcher = createKeyboardHandlerDispatcher([
      {
        keyMap: { ArrowUp: "lookUp" },
        createKeyHandler: (controlInput) => ({
          handleKeyDown: (action) => {
            controlInput[action] = true;
            return true;
          },
          handleKeyUp: (action) => {
            controlInput[action] = false;
            return true;
          },
        }),
      },
    ]);

    expect(dispatcher.controlInput.lookUp).toBe(false);
    expect(dispatcher.handleKey("ArrowUp", true, false)).toBe(true);
    expect(dispatcher.controlInput.lookUp).toBe(true);
    expect(dispatcher.handleKey("ArrowUp", false, false)).toBe(true);
    expect(dispatcher.controlInput.lookUp).toBe(false);
  });

  it("updates mapped actions that do not have provider-owned handlers", () => {
    const dispatcher = createKeyboardHandlerDispatcher([
      {
        actions: ["testTrim"],
        keyMap: { KeyF: "testFire" },
      },
    ]);

    expect(dispatcher.controlInput.testFire).toBe(false);
    expect(dispatcher.controlInput.testTrim).toBe(false);
    expect(dispatcher.handleKey("KeyF", true, false)).toBe(true);
    expect(dispatcher.controlInput.testFire).toBe(true);
    expect(dispatcher.handleKey("KeyF", false, false)).toBe(true);
    expect(dispatcher.controlInput.testFire).toBe(false);
    expect(dispatcher.handleKey("Unknown", true, false)).toBe(false);
  });

  it("shares provider-declared unlocked actions with key handlers", () => {
    let unlockedActions: ReadonlySet<string> | undefined;
    createKeyboardHandlerDispatcher([
      { unlockedActions: ["operatorSwapFocus"] },
      {
        createKeyHandler: (_controlInput, context) => {
          unlockedActions = context.unlockedActions;
          return {
            handleKeyDown: () => false,
            handleKeyUp: () => false,
          };
        },
      },
    ]);

    expect(unlockedActions).toEqual(new Set(["operatorSwapFocus"]));
  });
});
